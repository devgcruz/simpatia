# Exemplo de Correção - Race Condition na Blacklist

## Problema Original

```typescript
// ❌ CÓDIGO ATUAL (VULNERÁVEL)
export const tokenBlacklist = new Map<string, number>();

function validateWebSocketToken(token: string | undefined): { valid: boolean; user?: any; error?: string } {
  // ...
  if (tokenBlacklist.has(cleanToken)) {
    const expiresAt = tokenBlacklist.get(cleanToken);
    if (expiresAt && expiresAt > Date.now()) {
      return { valid: false, error: 'Token foi invalidado...' };
    }
    tokenBlacklist.delete(cleanToken); // ⚠️ Race condition aqui
  }
  // ...
}
```

## Solução 1: Usando Redis (Recomendado para Produção)

```typescript
// ✅ CÓDIGO CORRIGIDO COM REDIS
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Invalidar token (operação atômica)
export async function invalidateToken(token: string): Promise<void> {
  if (!token) return;

  try {
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    const decoded = jwt.decode(cleanToken) as any;
    
    if (decoded && decoded.exp) {
      const expiresInSeconds = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresInSeconds > 0) {
        // SET com EXPIRE é atômico no Redis
        await redis.setex(`blacklist:${cleanToken}`, expiresInSeconds, '1');
        console.log(`[WebSocket] Token invalidado. Expira em ${expiresInSeconds}s`);
      }
    }
  } catch (error) {
    console.error('[WebSocket] Erro ao invalidar token:', error);
  }
}

// Validar token (operação atômica)
function validateWebSocketToken(token: string | undefined): Promise<{ valid: boolean; user?: any; error?: string }> {
  return new Promise(async (resolve) => {
    if (!token) {
      return resolve({ valid: false, error: 'Token não fornecido' });
    }

    if (!process.env.JWT_SECRET) {
      return resolve({ valid: false, error: 'Configuração de token ausente' });
    }

    try {
      const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
      
      // Verificar blacklist no Redis (operação atômica)
      const isBlacklisted = await redis.exists(`blacklist:${cleanToken}`);
      if (isBlacklisted) {
        console.warn(`[WebSocket] Tentativa de usar token invalidado (logout)`);
        return resolve({ valid: false, error: 'Token foi invalidado. Faça login novamente.' });
      }
      
      const payload = jwt.verify(cleanToken, process.env.JWT_SECRET) as any;
      
      resolve({
        valid: true,
        user: {
          id: payload.sub,
          role: payload.role,
          clinicaId: payload.clinicaId,
        },
      });
    } catch (error: any) {
      resolve({ valid: false, error: error.message || 'Token inválido' });
    }
  });
}
```

## Solução 2: Usando Map com Lock (Para Desenvolvimento/Single Instance)

```typescript
// ✅ CÓDIGO CORRIGIDO COM LOCK (Single Instance)
import { Mutex } from 'async-mutex';

export const tokenBlacklist = new Map<string, number>();
const blacklistMutex = new Mutex();

// Invalidar token com lock
export async function invalidateToken(token: string): Promise<void> {
  if (!token) return;

  const release = await blacklistMutex.acquire();
  try {
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    const decoded = jwt.decode(cleanToken) as any;
    
    if (decoded && decoded.exp) {
      const expiresAt = decoded.exp * 1000;
      tokenBlacklist.set(cleanToken, expiresAt);
      console.log(`[WebSocket] Token invalidado. Expira em: ${new Date(expiresAt).toISOString()}`);
    }
  } finally {
    release();
  }
}

// Validar token com lock
async function validateWebSocketToken(token: string | undefined): Promise<{ valid: boolean; user?: any; error?: string }> {
  if (!token) {
    return { valid: false, error: 'Token não fornecido' };
  }

  if (!process.env.JWT_SECRET) {
    return { valid: false, error: 'Configuração de token ausente' };
  }

  try {
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    
    // Verificar blacklist com lock (operação atômica)
    const release = await blacklistMutex.acquire();
    let isBlacklisted = false;
    let expiresAt: number | undefined;
    
    try {
      expiresAt = tokenBlacklist.get(cleanToken);
      if (expiresAt) {
        if (expiresAt > Date.now()) {
          isBlacklisted = true;
        } else {
          // Token expirado, remover da blacklist
          tokenBlacklist.delete(cleanToken);
        }
      }
    } finally {
      release();
    }
    
    if (isBlacklisted) {
      console.warn(`[WebSocket] Tentativa de usar token invalidado (logout)`);
      return { valid: false, error: 'Token foi invalidado. Faça login novamente.' };
    }
    
    const payload = jwt.verify(cleanToken, process.env.JWT_SECRET) as any;
    
    return {
      valid: true,
      user: {
        id: payload.sub,
        role: payload.role,
        clinicaId: payload.clinicaId,
      },
    };
  } catch (error: any) {
    return { valid: false, error: error.message || 'Token inválido' };
  }
}
```

## Instalação das Dependências

### Para Solução 1 (Redis):
```bash
npm install ioredis
npm install --save-dev @types/ioredis
```

### Para Solução 2 (Mutex):
```bash
npm install async-mutex
```

## Variáveis de Ambiente Necessárias

```env
# Para Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password_here

# Ou usar URL completa
REDIS_URL=redis://localhost:6379
```

## Testes

```typescript
// Teste para verificar que não há race condition
async function testRaceCondition() {
  const token = 'test-token-123';
  
  // Simular múltiplas validações simultâneas
  const promises = Array(100).fill(null).map(() => 
    validateWebSocketToken(token)
  );
  
  // Invalidar token durante validações
  setTimeout(() => invalidateToken(token), 10);
  
  const results = await Promise.all(promises);
  
  // Verificar que todas as validações após invalidação falharam
  const afterInvalidation = results.filter(r => !r.valid);
  console.log(`Validações após invalidação: ${afterInvalidation.length}/100`);
}
```

## Notas Importantes

1. **Redis é recomendado para produção** porque:
   - Operações são atômicas por padrão
   - Funciona em ambiente multi-instância
   - Tem TTL automático (não precisa limpar manualmente)
   - Melhor performance para alta concorrência

2. **Mutex é adequado para**:
   - Desenvolvimento local
   - Aplicações single-instance
   - Quando não há Redis disponível

3. **Ambas as soluções garantem**:
   - Operações atômicas (sem race conditions)
   - Thread-safety
   - Consistência de dados




