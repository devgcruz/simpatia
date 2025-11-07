import { Router } from 'express';
import webhookController from '../controllers/webhook.controller';

const router = Router();

// A URL agora é dinâmica e captura o 'urlId'
// Ex: GET /api/webhook/whatsapp/a1b2c3d4-e5f6...
router.get('/:urlId', webhookController.handleVerifyWebhook);

// Ex: POST /api/webhook/whatsapp/a1b2c3d4-e5f6...
router.post('/:urlId', webhookController.handleReceiveMessage);

export default router;

