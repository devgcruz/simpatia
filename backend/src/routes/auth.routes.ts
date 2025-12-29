import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Proteção (Força Bruta): Limiter específico para o login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Limita cada IP a 10 tentativas por janela
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Rota de login com rate limiting
router.post('/login', loginLimiter, authController.handleLogin);

// Rota de logout
router.post('/logout', authController.handleLogout);

// Rota de refresh token
router.post('/refresh', authController.handleRefreshToken);

// --- ROTA NOVA ---
// GET /api/auth/me
// Esta rota verifica o token (via cookie) e retorna os dados do usuário.
router.get('/me', authMiddleware, authController.handleMe);

// Rota para atualizar perfil (senha e foto)
router.put('/profile', authMiddleware, authController.handleUpdateProfile);

// Rota para salvar chave pública E2E (Operation Whisper)
router.post('/public-key', authMiddleware, authController.handleSavePublicKey);

export default router;

