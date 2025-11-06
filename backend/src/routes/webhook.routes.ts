import { Router } from 'express';
import webhookController from '../controllers/webhook.controller';

const router = Router();

// Rota GET para verificação do webhook (usado pela Meta durante a configuração)
router.get('/', webhookController.handleVerifyWebhook);

// Rota POST para receber mensagens do WhatsApp
router.post('/', webhookController.handleReceiveMessage);

export default router;

