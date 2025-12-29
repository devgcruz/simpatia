import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { savePrivateKey, getPrivateKey, getPublicKey } from '../utils/indexedDB';
import { api } from '../services/api';

/**
 * Hook para gerenciar criptografia E2E no chat
 * Usa ECDH P-256 para troca de chaves e AES-GCM para criptografia de mensagens
 */
export const useChatEncryption = () => {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [publicKeyCache, setPublicKeyCache] = useState<Map<number, string>>(new Map());
  const privateKeyRef = useRef<CryptoKey | null>(null);

  /**
   * Gera um novo par de chaves ECDH P-256
   */
  const generateKeyPair = async (): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }> => {
    return await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true, // extractable
      ['deriveKey', 'deriveBits']
    );
  };

  /**
   * Exporta chave pública para formato string (base64)
   */
  const exportPublicKey = async (publicKey: CryptoKey): Promise<string> => {
    const exported = await crypto.subtle.exportKey('spki', publicKey);
    const bytes = new Uint8Array(exported);
    const base64 = btoa(String.fromCharCode(...bytes));
    console.log(`[E2E-DEBUG] Chave pública exportada - Tamanho: ${bytes.length} bytes, Base64: ${base64.length} chars`);
    return base64;
  };

  /**
   * Importa chave pública de formato string (base64)
   */
  const importPublicKey = async (publicKeyBase64: string): Promise<CryptoKey> => {
    try {
      const binary = atob(publicKeyBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      console.log(`[E2E-DEBUG] Importando chave pública - Base64 length: ${publicKeyBase64.length}, Binary length: ${bytes.length} bytes`);
      
      const importedKey = await crypto.subtle.importKey(
        'spki',
        bytes,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        true,
        []
      );
      
      console.log(`[E2E-DEBUG] ✓ Chave pública importada com sucesso`);
      return importedKey;
    } catch (error) {
      console.error(`[E2E-DEBUG] ✗ Erro ao importar chave pública:`, error);
      throw error;
    }
  };

  /**
   * Deriva chave compartilhada usando ECDH
   */
  const deriveSharedSecret = async (
    privateKey: CryptoKey,
    publicKey: CryptoKey
  ): Promise<CryptoKey> => {
    return await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: publicKey,
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // não exportável
      ['encrypt', 'decrypt']
    );
  };

  /**
   * Inicializa ou recupera o par de chaves do usuário
   */
  const initKeys = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      console.warn('[E2E] Usuário não autenticado');
      return false;
    }

    try {
      // Tentar recuperar chave privada do IndexedDB
      let privateKey = await getPrivateKey(Number(user.id));

      if (!privateKey) {
        // Gerar novo par de chaves
        console.log('[E2E] Gerando novo par de chaves para usuário', user.id);
        const keyPair = await generateKeyPair();
        privateKey = keyPair.privateKey;

        // Exportar chave pública antes de salvar
        const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
        
        // Salvar chave privada E pública no IndexedDB
        await savePrivateKey(Number(user.id), privateKey, keyPair.publicKey);
        try {
          await api.post('/auth/public-key', { publicKey: publicKeyBase64 });
          console.log('[E2E] Chave pública enviada para o servidor');
        } catch (error) {
          console.error('[E2E] Erro ao enviar chave pública:', error);
          // Continuar mesmo se falhar
        }
      } else {
        console.log('[E2E] Chave privada recuperada do IndexedDB');
        
        // Recuperar chave pública salva localmente (se existir)
        const localPublicKeyBase64 = await getPublicKey(Number(user.id));
        
        // IMPORTANTE: Verificar se a chave pública local corresponde à chave pública no servidor
        try {
          // Tentar buscar chave pública do servidor
          const response = await api.get(`/chat/public-key/${user.id}`).catch(() => null);
          const serverPublicKeyBase64 = response?.data?.publicKey;
          
          if (!serverPublicKeyBase64) {
            // Chave pública não existe no servidor
            if (localPublicKeyBase64) {
              // Temos a chave pública local, vamos enviá-la ao servidor
              console.log('[E2E] Chave pública não encontrada no servidor, enviando chave pública local...');
              try {
                await api.post('/auth/public-key', { publicKey: localPublicKeyBase64 });
                console.log('[E2E] Chave pública local enviada para o servidor');
              } catch (sendError) {
                console.error('[E2E] Erro ao enviar chave pública local:', sendError);
              }
            } else {
              // Não temos chave pública local nem no servidor - gerar novo par
              console.log('[E2E] Chave pública não encontrada localmente nem no servidor, gerando novo par');
              const keyPair = await generateKeyPair();
              privateKey = keyPair.privateKey;
              const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
              await savePrivateKey(Number(user.id), privateKey, keyPair.publicKey);
              await api.post('/auth/public-key', { publicKey: publicKeyBase64 });
              console.log('[E2E] Novo par de chaves gerado e chave pública enviada');
            }
          } else if (localPublicKeyBase64 && localPublicKeyBase64 !== serverPublicKeyBase64) {
            // Chave pública local não corresponde à chave pública no servidor
            // Isso significa que as chaves foram regeneradas - precisamos usar a chave do servidor
            // Mas não podemos derivar a chave privada da pública, então precisamos gerar novo par
            console.warn('[E2E] ⚠️ Chave pública local não corresponde à chave pública no servidor!');
            console.warn('[E2E] Isso pode indicar que as chaves foram regeneradas. Gerando novo par...');
            const keyPair = await generateKeyPair();
            privateKey = keyPair.privateKey;
            const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
            await savePrivateKey(Number(user.id), privateKey, keyPair.publicKey);
            await api.post('/auth/public-key', { publicKey: publicKeyBase64 });
            console.log('[E2E] Novo par de chaves gerado e sincronizado');
          } else {
            // Chaves estão sincronizadas
            if (!localPublicKeyBase64 && serverPublicKeyBase64) {
              // Temos chave pública no servidor mas não localmente - salvar localmente
              console.log('[E2E] Chave pública encontrada no servidor, mas não localmente. Salvando localmente...');
              // Não podemos importar a chave pública sem a chave privada correspondente
              // Mas podemos salvar a string base64 para referência futura
              // Por enquanto, vamos apenas logar
              console.log('[E2E] Chave pública já existe no servidor e está sincronizada');
            } else {
              console.log('[E2E] Chave pública já existe no servidor e está sincronizada');
            }
          }
        } catch (error: any) {
          // Se der 404, significa que não existe, então vamos tentar enviar a local
          // Se der 403, significa que o role não tem permissão
          if (error?.response?.status === 404 || error?.response?.status === 403) {
            if (localPublicKeyBase64) {
              console.log(`[E2E] Chave pública não encontrada no servidor (${error?.response?.status}), enviando chave pública local...`);
              try {
                await api.post('/auth/public-key', { publicKey: localPublicKeyBase64 });
                console.log('[E2E] Chave pública local enviada para o servidor');
              } catch (sendError) {
                console.error('[E2E] Erro ao enviar chave pública local:', sendError);
              }
            } else {
              console.log(`[E2E] Chave pública não encontrada ou sem permissão (${error?.response?.status}), gerando novo par`);
              try {
                const keyPair = await generateKeyPair();
                privateKey = keyPair.privateKey;
                const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
                await savePrivateKey(Number(user.id), privateKey, keyPair.publicKey);
                await api.post('/auth/public-key', { publicKey: publicKeyBase64 });
                console.log('[E2E] Novo par de chaves gerado e chave pública enviada');
              } catch (saveError) {
                console.error('[E2E] Erro ao gerar/enviar novo par:', saveError);
              }
            }
          } else {
            console.warn('[E2E] Erro ao verificar chave pública:', error);
          }
        }
      }

      privateKeyRef.current = privateKey;
      setIsInitialized(true);
      return true;
    } catch (error) {
      console.error('[E2E] Erro ao inicializar chaves:', error);
      return false;
    }
  }, [user?.id]);

  /**
   * Busca chave pública de um contato (com cache)
   * @param contactId - ID do contato
   * @param forceRefetch - Se true, ignora o cache e busca da API novamente
   */
  const getContactPublicKey = useCallback(async (contactId: number, forceRefetch: boolean = false): Promise<string | null> => {
    // Verificar cache primeiro (a menos que forceRefetch seja true)
    if (!forceRefetch && publicKeyCache.has(contactId)) {
      const cachedKey = publicKeyCache.get(contactId);
      console.log(`[E2E-DEBUG] Chave pública do contato ${contactId} encontrada no cache`);
      return cachedKey || null;
    }

    try {
      console.log(`[E2E-DEBUG] Buscando chave pública do contato ${contactId}${forceRefetch ? ' (force refetch)' : ''}`);
      // Buscar do servidor
      const response = await api.get(`/chat/public-key/${contactId}`);
      const publicKeyBase64 = response.data.publicKey;
      
      if (publicKeyBase64) {
        // Adicionar ao cache
        setPublicKeyCache((prev) => new Map(prev).set(contactId, publicKeyBase64));
        console.log(`[E2E-DEBUG] ✓ Chave pública do contato ${contactId} obtida com sucesso (tamanho: ${publicKeyBase64.length} chars)`);
        return publicKeyBase64;
      } else {
        console.warn(`[E2E-DEBUG] ✗ Chave pública do contato ${contactId} não encontrada no servidor`);
      }
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message || 'Erro desconhecido';
      console.error(`[E2E-DEBUG] ✗ Erro ao buscar chave pública do contato ${contactId}:`, {
        status,
        message,
        forceRefetch,
      });
    }

    return null;
  }, [publicKeyCache]);

  /**
   * Criptografa uma mensagem para um destinatário
   */
  const encryptMessage = useCallback(
    async (text: string, receiverId: number): Promise<string> => {
      if (!privateKeyRef.current) {
        console.warn('[E2E] Chave privada não inicializada, enviando mensagem sem criptografia');
        return text;
      }

      try {
        // Buscar chave pública do destinatário
        const receiverPublicKeyBase64 = await getContactPublicKey(receiverId);
        if (!receiverPublicKeyBase64) {
          console.warn(`[E2E] Chave pública do destinatário ${receiverId} não encontrada, enviando sem criptografia`);
          return text;
        }

        // Importar chave pública
        console.log(`[E2E-DEBUG] [ENCRYPT] Importando chave pública do destinatário ${receiverId}...`);
        const receiverPublicKey = await importPublicKey(receiverPublicKeyBase64);

        // Derivar chave compartilhada
        // IMPORTANTE: ECDH requer: deriveKey(privateKey_remetente, publicKey_destinatario)
        console.log(`[E2E-DEBUG] [ENCRYPT] Derivando chave compartilhada (privateKey_remetente + publicKey_destinatario)...`);
        const sharedSecret = await deriveSharedSecret(privateKeyRef.current, receiverPublicKey);

        // Gerar IV único
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Criptografar mensagem
        const encodedText = new TextEncoder().encode(text);
        const encrypted = await crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: iv,
          },
          sharedSecret,
          encodedText
        );

        // Converter para base64
        const ivBase64 = btoa(String.fromCharCode(...iv));
        const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

        // Formato: iv:ciphertext
        return `${ivBase64}:${ciphertextBase64}`;
      } catch (error) {
        console.error('[E2E] Erro ao criptografar mensagem:', error);
        // Fallback: retornar texto original
        return text;
      }
    },
    [getContactPublicKey]
  );

  /**
   * Descriptografa uma mensagem de um remetente
   * Implementa "Smart Retry" com refetch automático de chave pública em caso de falha
   */
  const decryptMessage = useCallback(
    async (encryptedPayload: string, senderId: number): Promise<string> => {
      const payloadSize = encryptedPayload.length;
      console.log(`[E2E-DEBUG] Iniciando descriptografia - Sender ID: ${senderId}, Payload size: ${payloadSize} bytes`);

      // Verificar se é uma mensagem criptografada (formato: iv:ciphertext)
      if (!encryptedPayload.includes(':')) {
        // Mensagem antiga não criptografada
        console.log(`[E2E-DEBUG] Mensagem não criptografada (sem ':'), retornando como está`);
        return encryptedPayload;
      }

      if (!privateKeyRef.current) {
        console.warn('[E2E-DEBUG] ✗ Chave privada não inicializada, retornando mensagem sem descriptografar');
        return encryptedPayload;
      }

      // Função auxiliar para tentar descriptografar
      const attemptDecryption = async (useForceRefetch: boolean = false): Promise<string> => {
        try {
          // Separar IV e ciphertext
          const parts = encryptedPayload.split(':');
          
          if (parts.length !== 2) {
            console.error(`[E2E-DEBUG] ✗ Formato inválido: esperado iv:ciphertext, mas recebido ${parts.length} partes`);
            console.error(`[E2E-DEBUG] Payload preview: ${encryptedPayload.substring(0, 100)}...`);
            return encryptedPayload;
          }

          const [ivBase64, ciphertextBase64] = parts;
          
          if (!ivBase64 || !ciphertextBase64) {
            console.warn('[E2E-DEBUG] ✗ IV ou ciphertext vazio');
            return encryptedPayload;
          }

          console.log(`[E2E-DEBUG] Parsing payload - IV length: ${ivBase64.length}, Ciphertext length: ${ciphertextBase64.length}`);

          // Buscar chave pública do remetente (com forceRefetch se necessário)
          const senderPublicKeyBase64 = await getContactPublicKey(senderId, useForceRefetch);
          if (!senderPublicKeyBase64) {
            console.warn(`[E2E-DEBUG] ✗ Chave pública do remetente ${senderId} não encontrada${useForceRefetch ? ' (após refetch)' : ''}`);
            return encryptedPayload;
          }

          console.log(`[E2E-DEBUG] ✓ Chave pública obtida${useForceRefetch ? ' (via force refetch)' : ' (do cache)'}`);

          // Importar chave pública
          console.log(`[E2E-DEBUG] [DECRYPT] Importando chave pública do remetente ${senderId}...`);
          const senderPublicKey = await importPublicKey(senderPublicKeyBase64);
          console.log(`[E2E-DEBUG] [DECRYPT] ✓ Chave pública importada com sucesso`);

          // Verificar se a chave privada ainda está disponível
          if (!privateKeyRef.current) {
            throw new Error('Chave privada não disponível durante descriptografia');
          }

          // Derivar chave compartilhada
          // IMPORTANTE: ECDH requer: deriveKey(privateKey_destinatario, publicKey_remetente)
          // Isso deve resultar na mesma chave compartilhada que foi usada para criptografar
          console.log(`[E2E-DEBUG] [DECRYPT] Derivando chave compartilhada (privateKey_destinatario + publicKey_remetente)...`);
          const sharedSecret = await deriveSharedSecret(privateKeyRef.current, senderPublicKey);
          console.log('[E2E-DEBUG] [DECRYPT] ✓ Chave compartilhada derivada com sucesso');

          // Validar formato base64 antes de decodificar
          const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
          if (!base64Regex.test(ivBase64) || !base64Regex.test(ciphertextBase64)) {
            console.error('[E2E-DEBUG] ✗ Formato base64 inválido');
            return encryptedPayload;
          }

          // Converter de base64
          let iv: Uint8Array;
          let ciphertext: Uint8Array;
          
          try {
            const ivBinary = atob(ivBase64);
            iv = new Uint8Array(ivBinary.length);
            for (let i = 0; i < ivBinary.length; i++) {
              iv[i] = ivBinary.charCodeAt(i);
            }
            console.log(`[E2E-DEBUG] IV decodificado - Tamanho: ${iv.length} bytes (esperado: 12 para AES-GCM)`);
            if (iv.length !== 12) {
              console.error(`[E2E-DEBUG] ✗ IV tem tamanho incorreto: ${iv.length} bytes (deve ser 12)`);
              return encryptedPayload;
            }
          } catch (error) {
            console.error('[E2E-DEBUG] ✗ Erro ao decodificar IV:', error);
            return encryptedPayload;
          }

          try {
            const ciphertextBinary = atob(ciphertextBase64);
            ciphertext = new Uint8Array(ciphertextBinary.length);
            for (let i = 0; i < ciphertextBinary.length; i++) {
              ciphertext[i] = ciphertextBinary.charCodeAt(i);
            }
            console.log(`[E2E-DEBUG] Ciphertext decodificado - Tamanho: ${ciphertext.length} bytes`);
          } catch (error) {
            console.error('[E2E-DEBUG] ✗ Erro ao decodificar ciphertext:', error);
            return encryptedPayload;
          }

          // Validar tamanho do IV antes de descriptografar
          if (iv.length !== 12) {
            console.error(`[E2E-DEBUG] ✗ IV tem tamanho incorreto: ${iv.length} bytes (esperado: 12 bytes para AES-GCM)`);
            throw new Error(`IV inválido: ${iv.length} bytes (esperado: 12)`);
          }
          
          // Validar que temos todos os dados necessários
          if (!ciphertext || ciphertext.length === 0) {
            console.error(`[E2E-DEBUG] ✗ Ciphertext vazio`);
            throw new Error('Ciphertext vazio');
          }
          
          // Descriptografar usando AES-GCM
          console.log('[E2E-DEBUG] Tentando descriptografar com AES-GCM...');
          console.log(`[E2E-DEBUG] Parâmetros: IV=${iv.length} bytes, Ciphertext=${ciphertext.length} bytes`);
          
          try {
            // Log detalhado antes de descriptografar
            console.log(`[E2E-DEBUG] Chamando crypto.subtle.decrypt com:`);
            console.log(`[E2E-DEBUG]   - IV: ${iv.length} bytes, ArrayBuffer size: ${iv.buffer.byteLength}`);
            console.log(`[E2E-DEBUG]   - Ciphertext: ${ciphertext.length} bytes, ArrayBuffer size: ${ciphertext.buffer.byteLength}`);
            console.log(`[E2E-DEBUG]   - SharedSecret: ${sharedSecret ? 'disponível' : 'NÃO disponível'}`);
            
            const decrypted = await crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv: iv.buffer as ArrayBuffer,
              },
              sharedSecret,
              ciphertext.buffer as ArrayBuffer
            );

            const decryptedText = new TextDecoder().decode(decrypted);
            console.log(`[E2E-DEBUG] ✓ AES-GCM descriptografia bem-sucedida - Tamanho do texto: ${decryptedText.length} chars`);
            return decryptedText;
          } catch (error: any) {
            const errorName = error?.name || 'UnknownError';
            const errorMessage = error?.message || 'Erro desconhecido';
            console.error(`[E2E-DEBUG] ✗ Falha na descriptografia (${errorName}):`, errorMessage);
            throw error; // Re-throw para permitir retry
          }
        } catch (error: any) {
          const errorName = error?.name || 'UnknownError';
          const errorMessage = error?.message || 'Erro desconhecido';
          console.error(`[E2E-DEBUG] ✗ Erro em attemptDecryption (${errorName}):`, errorMessage);
          throw error; // Re-throw para permitir retry
        }
      };

      // Primeira tentativa (usando cache)
      try {
        return await attemptDecryption(false);
      } catch (error: any) {
        console.warn(`[E2E-DEBUG] Falha na primeira tentativa de descriptografia, tentando atualizar chaves...`);
        
        // Segunda tentativa (com forceRefetch)
        try {
          console.log(`[E2E-DEBUG] Tentando refetch da chave pública do remetente ${senderId}...`);
          const result = await attemptDecryption(true);
          console.log(`[E2E-DEBUG] ✓ Retry bem-sucedido após refetch da chave pública`);
          return result;
        } catch (retryError: any) {
          const retryErrorName = retryError?.name || 'UnknownError';
          const retryErrorMessage = retryError?.message || 'Erro desconhecido';
          console.error(`[E2E-DEBUG] ✗ Falha fatal na descriptografia após retry (${retryErrorName}):`, retryErrorMessage);
          
          // Retornar string de erro específica em vez do payload cru
          return '⚠️ Falha na descriptografia';
        }
      }
    },
    [getContactPublicKey]
  );

  // Inicializar chaves ao montar o componente
  useEffect(() => {
    if (user?.id && !isInitialized) {
      initKeys();
    }
  }, [user?.id, isInitialized, initKeys]);

  return {
    isInitialized,
    encryptMessage,
    decryptMessage,
    initKeys,
  };
};

