import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Diretório para armazenar as chaves RSA
const KEYS_DIR = path.join(__dirname, '../../keys');

// Garantir que o diretório existe
if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
}

const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

/**
 * Gera par de chaves RSA se não existirem
 */
function ensureRSAKeys(): { privateKey: string; publicKey: string } {
  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    return {
      privateKey: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
      publicKey: fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'),
    };
  }

  console.log('🔑 Gerando par de chaves RSA para JWT...');
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);

  console.log('✅ Chaves RSA geradas com sucesso!');
  
  return { privateKey, publicKey };
}

const { privateKey, publicKey } = ensureRSAKeys();

export interface TokenPayload {
  sub: number; // User ID
  email: string;
  role: string;
  clinicaId: number | null;
  type?: 'access' | 'refresh';
}

/**
 * Gera um token de acesso JWT usando RS256
 */
export function generateAccessToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: '15m', // Token de acesso curto (15 minutos)
    }
  );
}

/**
 * Gera um refresh token JWT usando RS256
 */
export function generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: '7d', // Refresh token válido por 7 dias
    }
  );
}

/**
 * Verifica e decodifica um token JWT
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    }) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expirado');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token inválido');
    }
    throw error;
  }
}

/**
 * Obtém a chave pública (para validação em outros serviços)
 */
export function getPublicKey(): string {
  return publicKey;
}

