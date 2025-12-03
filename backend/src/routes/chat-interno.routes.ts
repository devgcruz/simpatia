import { Router } from 'express';
import chatInternoController from '../controllers/chat-interno.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting para envio de mensagens
const messageRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // máximo 20 mensagens por minuto
  message: 'Muitas mensagens enviadas. Tente novamente em alguns instantes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para criação de conversas
const conversationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máximo 10 conversas por 5 minutos
  message: 'Muitas conversas criadas. Tente novamente em alguns instantes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rotas
router.post('/conversas/individual', conversationRateLimit, chatInternoController.createConversaIndividual);
router.post('/conversas/grupo', conversationRateLimit, chatInternoController.createConversaGrupo);
router.get('/conversas', chatInternoController.listConversas);
router.get('/conversas/buscar', chatInternoController.buscarConversas);
router.get('/conversas/:conversaId/mensagens', chatInternoController.getMensagens);
router.post('/mensagens', messageRateLimit, chatInternoController.sendMensagem);
router.post('/conversas/:conversaId/marcar-lidas', chatInternoController.marcarMensagensComoLidas);
router.post('/conversas/:conversaId/participantes', chatInternoController.adicionarParticipante);
router.delete('/conversas/:conversaId/participantes', chatInternoController.removerParticipante);
router.get('/usuarios/online', chatInternoController.getUsuariosOnline);
router.get('/usuarios/disponiveis', chatInternoController.getUsuariosDisponiveis);

export default router;

