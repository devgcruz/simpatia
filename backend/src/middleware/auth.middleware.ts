// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { tokenBlacklist } from '../services/websocket.service';
import { verifyToken } from '../utils/jwt.util';

// Este middleware será usado em todas as rotas que precisam de proteção
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 1. Pegamos o token do cookie (que foi setado no login)
  const token = req.cookies?.token;

  // 2. Se não houver token, o usuário não está logado
  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
  }

  try {
    // 3. Verificar se o token está na blacklist (foi invalidado via logout)
    if (tokenBlacklist.has(token)) {
      const expiresAt = tokenBlacklist.get(token);
      // Se ainda não expirou naturalmente, o token está invalidado
      if (expiresAt && expiresAt > Date.now()) {
        console.warn(`[Auth Middleware] Tentativa de usar token invalidado (logout)`);
        return res.status(401).json({ message: 'Token foi invalidado. Faça login novamente.' });
      }
      // Se expirou, remover da blacklist
      tokenBlacklist.delete(token);
    }

    // 4. Verificamos se o token é válido usando RS256
    const payload = verifyToken(token);

    // Verificar se é um access token
    if (payload.type && payload.type !== 'access') {
      return res.status(401).json({ message: 'Token inválido: deve ser um access token' });
    }

    // 5. Injetamos os dados do payload (id, role, clinicaId)
    //    dentro do objeto 'req.user'
    // Garantir que o ID seja sempre um número
    req.user = {
      id: typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : payload.sub,
      role: payload.role,
      clinicaId: payload.clinicaId,
    };

    // 6. Deixamos a requisição continuar para o seu destino (o controller)
    next();
  } catch (error: any) {
    // Se o token for inválido ou expirado
    console.error('Erro na verificação do token:', error.message);
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
};

export const isSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Acesso negado. Apenas Super Admins podem executar esta ação.' });
  }

  next();
};
