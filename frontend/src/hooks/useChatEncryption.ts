import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { savePrivateKey, getPrivateKey } from '../utils/indexedDB';
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
    const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    return base64;
  };

  /**
   * Importa chave pública de formato string (base64)
   */
  const importPublicKey = async (publicKeyBase64: string): Promise<CryptoKey> => {
    const binary = atob(publicKeyBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return await crypto.subtle.importKey(
      'spki',
      bytes,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
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

        // Salvar chave privada no IndexedDB
        await savePrivateKey(Number(user.id), privateKey);

        // Exportar e enviar chave pública para o servidor
        const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
        try {
          await api.post('/auth/public-key', { publicKey: publicKeyBase64 });
          console.log('[E2E] Chave pública enviada para o servidor');
        } catch (error) {
          console.error('[E2E] Erro ao enviar chave pública:', error);
          // Continuar mesmo se falhar
        }
      } else {
        console.log('[E2E] Chave privada recuperada do IndexedDB');
        
        // IMPORTANTE: Sempre verificar e enviar chave pública para o servidor
        // Mesmo se já tiver chave privada, pode ser que a chave pública não esteja no servidor
        try {
          // Tentar buscar se já existe no servidor
          const response = await api.get(`/chat/public-key/${user.id}`).catch(() => null);
          
          if (!response || !response.data?.publicKey) {
            // Chave pública não existe no servidor
            // Para ECDH, não podemos derivar a chave pública da privada diretamente
            // Então vamos gerar um novo par e substituir
            console.log('[E2E] Chave pública não encontrada no servidor, gerando novo par');
            const keyPair = await generateKeyPair();
            privateKey = keyPair.privateKey;
            await savePrivateKey(Number(user.id), privateKey);
            
            const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
            await api.post('/auth/public-key', { publicKey: publicKeyBase64 });
            console.log('[E2E] Novo par de chaves gerado e chave pública enviada');
          } else {
            console.log('[E2E] Chave pública já existe no servidor');
          }
        } catch (error: any) {
          // Se der 404, significa que não existe, então vamos gerar novo par
          // Se der 403, significa que o role não tem permissão (mas já corrigimos no backend)
          if (error?.response?.status === 404 || error?.response?.status === 403) {
            console.log(`[E2E] Chave pública não encontrada ou sem permissão (${error?.response?.status}), gerando novo par`);
            try {
              const keyPair = await generateKeyPair();
              privateKey = keyPair.privateKey;
              await savePrivateKey(Number(user.id), privateKey);
              
              const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
              await api.post('/auth/public-key', { publicKey: publicKeyBase64 });
              console.log('[E2E] Novo par de chaves gerado e chave pública enviada');
            } catch (saveError) {
              console.error('[E2E] Erro ao gerar/enviar novo par:', saveError);
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
   */
  const getContactPublicKey = useCallback(async (contactId: number): Promise<string | null> => {
    // Verificar cache primeiro
    if (publicKeyCache.has(contactId)) {
      return publicKeyCache.get(contactId) || null;
    }

    try {
      // Buscar do servidor
      const response = await api.get(`/chat/public-key/${contactId}`);
      const publicKeyBase64 = response.data.publicKey;
      
      if (publicKeyBase64) {
        // Adicionar ao cache
        setPublicKeyCache((prev) => new Map(prev).set(contactId, publicKeyBase64));
        return publicKeyBase64;
      }
    } catch (error) {
      console.error(`[E2E] Erro ao buscar chave pública do contato ${contactId}:`, error);
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
        const receiverPublicKey = await importPublicKey(receiverPublicKeyBase64);

        // Derivar chave compartilhada
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
   */
  const decryptMessage = useCallback(
    async (encryptedPayload: string, senderId: number): Promise<string> => {
      // Verificar se é uma mensagem criptografada (formato: iv:ciphertext)
      if (!encryptedPayload.includes(':')) {
        // Mensagem antiga não criptografada
        return encryptedPayload;
      }

      if (!privateKeyRef.current) {
        console.warn('[E2E] Chave privada não inicializada, retornando mensagem sem descriptografar');
        return encryptedPayload;
      }

      try {
        // Separar IV e ciphertext
        // O formato é: ivBase64:ciphertextBase64
        // IMPORTANTE: Base64 pode ter padding com '=', mas nunca terá ':' dentro
        // Se houver múltiplos ':', significa que o ciphertext foi truncado ou há problema no formato
        const parts = encryptedPayload.split(':');
        
        if (parts.length !== 2) {
          console.error('[E2E] Formato inválido: esperado iv:ciphertext, mas recebido', parts.length, 'partes');
          console.error('[E2E] Payload completo:', encryptedPayload.substring(0, 100));
          return encryptedPayload;
        }

        const [ivBase64, ciphertextBase64] = parts;
        
        if (!ivBase64 || !ciphertextBase64) {
          console.warn('[E2E] IV ou ciphertext vazio, retornando original');
          return encryptedPayload;
        }

        console.log('[E2E] Descriptografando - IV length:', ivBase64.length, 'Ciphertext length:', ciphertextBase64.length);

        // Buscar chave pública do remetente
        const senderPublicKeyBase64 = await getContactPublicKey(senderId);
        if (!senderPublicKeyBase64) {
          console.warn(`[E2E] Chave pública do remetente ${senderId} não encontrada, retornando sem descriptografar`);
          return encryptedPayload;
        }

        // Importar chave pública
        const senderPublicKey = await importPublicKey(senderPublicKeyBase64);

        // Derivar chave compartilhada
        const sharedSecret = await deriveSharedSecret(privateKeyRef.current, senderPublicKey);

        // Validar formato base64 antes de decodificar
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(ivBase64) || !base64Regex.test(ciphertextBase64)) {
          console.error('[E2E] Formato base64 inválido:', { ivBase64: ivBase64.substring(0, 20), ciphertextBase64: ciphertextBase64.substring(0, 20) });
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
        } catch (error) {
          console.error('[E2E] Erro ao decodificar IV:', error, 'IV:', ivBase64.substring(0, 50));
          return encryptedPayload;
        }

        try {
          const ciphertextBinary = atob(ciphertextBase64);
          ciphertext = new Uint8Array(ciphertextBinary.length);
          for (let i = 0; i < ciphertextBinary.length; i++) {
            ciphertext[i] = ciphertextBinary.charCodeAt(i);
          }
        } catch (error) {
          console.error('[E2E] Erro ao decodificar ciphertext:', error, 'Ciphertext:', ciphertextBase64.substring(0, 50));
          return encryptedPayload;
        }

        // Descriptografar
        const decrypted = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv.buffer as ArrayBuffer,
          },
          sharedSecret,
          ciphertext.buffer as ArrayBuffer
        );

        return new TextDecoder().decode(decrypted);
      } catch (error) {
        console.error('[E2E] Erro ao descriptografar mensagem:', error);
        // Fallback: retornar payload original
        return encryptedPayload;
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

