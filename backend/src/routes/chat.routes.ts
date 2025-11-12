import { Router } from 'express';
import chatController from '../controllers/chat.controller';

const router = Router();

router.get('/handoff', chatController.handleGetHandoffPacientes);
router.get('/paciente/:pacienteId', chatController.handleGetChatHistory);
router.post('/paciente/:pacienteId/send', chatController.handleDoutorSendMessage);
router.post('/paciente/:pacienteId/close', chatController.handleCloseChat);

export default router;

