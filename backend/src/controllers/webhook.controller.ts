// src/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import iaService from '../services/ia.service';

class WebhookController {

  /**
   * Lida com a VERIFICAÇÃO da Meta (GET)
   */
  async handleVerifyWebhook(req: Request, res: Response) {
    try {
      // 1. Pega o ID da URL
      const { urlId } = req.params;
      if (!urlId) {
        return res.status(400).send('Missing webhook identifier.');
      }

      // 2. Pega os parâmetros de verificação da Meta
      const mode = req.query['hub.mode'];
      const challenge = req.query['hub.challenge'];
      const token = req.query['hub.verify_token'];

      // 3. Busca a clínica no banco usando o ID da URL
      const clinica = await prisma.clinica.findUnique({
        where: { webhookUrlId: urlId },
      });

      // 4. Se a clínica não existir, não é nosso webhook
      if (!clinica) {
        console.warn(`Webhook não encontrado para urlId: ${urlId}`);
        return res.status(404).send('Webhook not found.');
      }

      // 5. Verifica se o modo é 'subscribe' e se o token bate com o token DO BANCO
      if (mode === 'subscribe' && token === clinica.webhookVerifyToken) {
        console.log(`Webhook verificado com sucesso para a Clínica: ${clinica.nome}`);
        return res.status(200).send(challenge);
      } else {
        console.warn(`Falha na verificação do webhook para a Clínica: ${clinica.nome}`);
        return res.status(403).send('Forbidden');
      }
    } catch (error: any) {
      console.error('Erro na verificação do webhook:', error.message);
      return res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Lida com o RECEBIMENTO de mensagens (POST)
   */
  async handleReceiveMessage(req: Request, res: Response) {
    try {
      // 1. Pega o ID da URL
      const { urlId } = req.params;
      if (!urlId) {
        return res.status(400).send('Missing webhook identifier.');
      }

      // 2. Busca a clínica no banco
      const clinica = await prisma.clinica.findUnique({
        where: { webhookUrlId: urlId },
      });

      // 3. Se a clínica não existir, ignora a mensagem
      if (!clinica) {
        console.warn(`Mensagem recebida para webhook não encontrado: ${urlId}`);
        return res.status(404).send('Webhook not found.');
      }

      // 4. Inicia o processamento da IA (sem 'await'!)
      // Nós disparamos a IA e respondemos 200 imediatamente.
      // A IA processará em segundo plano.
      iaService.handleMensagem(req.body, clinica);

      // 5. Responde 200 IMEDIATAMENTE para a Meta
      return res.status(200).send('EVENT_RECEIVED');

    } catch (error: any) {
      console.error('Erro ao processar mensagem do webhook:', error.message);
      return res.status(500).send('Internal Server Error');
    }
  }
}

export default new WebhookController();

