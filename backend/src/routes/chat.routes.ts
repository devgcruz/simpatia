import { Router } from 'express';
import chatController from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/handoff', chatController.handleGetHandoffPacientes);
router.get('/paciente/:pacienteId', chatController.handleGetChatHistory);
router.post('/paciente/:pacienteId/send', chatController.handleDoutorSendMessage);
router.post('/paciente/:pacienteId/close', chatController.handleCloseChat);

// Rota para buscar chave pública E2E (Operation Whisper)
// Requer autenticação para buscar chaves públicas
router.get('/public-key/:userId', authMiddleware, chatController.handleGetPublicKey);

export default router;

