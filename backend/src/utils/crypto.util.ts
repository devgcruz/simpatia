import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Fail Fast: ENCRYPTION_KEY é obrigatória (32 bytes em hex = 64 caracteres)
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY_HEX) {
  throw new Error('ENCRYPTION_KEY não configurada. Configure uma chave de 32 bytes (64 caracteres hex) no .env');
}

if (ENCRYPTION_KEY_HEX.length !== 64) {
  throw new Error(`ENCRYPTION_KEY inválida. Esperado 64 caracteres hex (32 bytes), recebido ${ENCRYPTION_KEY_HEX.length}`);
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');

/**
 * Criptografa texto usando AES-256-GCM
 * Output format: iv:authTag:encryptedContent (tudo em hex)
 * 
 * @param text - Texto a ser criptografado
 * @returns String no formato iv:authTag:encryptedContent (hex)
 */
export function encrypt(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  try {
    // Gerar IV único para cada operação
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Formato: iv:authTag:encryptedContent (tudo em hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('[Crypto] Erro ao criptografar:', error instanceof Error ? error.message : 'Erro desconhecido');
    throw new Error('Falha ao criptografar dados');
  }
}

/**
 * Descriptografa texto usando AES-256-GCM
 * 
 * @param hash - String no formato iv:authTag:encryptedContent (hex)
 * @returns Texto descriptografado
 */
export function decrypt(hash: string): string {
  if (!hash || typeof hash !== 'string') {
    return hash;
  }

  // Verificar se é um hash criptografado (formato: iv:authTag:encryptedContent)
  // Se não tiver o formato esperado, retornar como está (pode ser texto não criptografado legado)
  const parts = hash.split(':');
  if (parts.length !== 3) {
    // Dado não criptografado ou formato inválido
    return hash;
  }

  try {
    const [ivHex, tagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // Erro de decriptação (chave errada, dado corrompido, etc.)
    // Log sanitizado (sem stack trace)
    console.error('[Crypto] Erro ao descriptografar: Dado corrompido ou chave inválida');
    // Retornar marcador de dado corrompido (nunca vazar stack trace)
    return '[DADO CORROMPIDO]';
  }
}

/**
 * Gera um hash seguro para validação (mantido para compatibilidade)
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Exportar funções antigas para compatibilidade (deprecated)
/** @deprecated Use encrypt() instead */
export const encryptMessage = encrypt;
/** @deprecated Use decrypt() instead */
export const decryptMessage = decrypt;

