import { Request, Response } from 'express';
import iaService from '../services/ia.service';

// Token de verificação do webhook (deve ser o mesmo configurado na plataforma da Meta)
const VERIFY_TOKEN = "MEU_TOKEN_SECRETO_DO_WHATSAPP";

class WebhookController {

    async handleVerifyWebhook(req: Request, res: Response) {
        try {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            // Verificar se o mode é 'subscribe' e o token está correto
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('Webhook verificado com sucesso!');
                return res.status(200).send(challenge);
            } else {
                console.log('Falha na verificação do webhook. Token ou mode inválidos.');
                return res.status(403).send('Forbidden');
            }
        } catch (error: any) {
            console.error('Erro ao verificar webhook:', error);
            return res.status(500).json({ message: error.message });
        }
    }

    async handleReceiveMessage(req: Request, res: Response) {
        try {
            // Logar o corpo da mensagem para análise
            console.log('=== Mensagem recebida do WhatsApp ===');
            console.log(JSON.stringify(req.body, null, 2));
            console.log('=====================================');

            // Responder IMEDIATAMENTE com status 200 para a Meta
            // É crucial responder rapidamente para evitar timeouts
            res.status(200).send('EVENT_RECEIVED');

            // Processar a mensagem de forma assíncrona (não bloqueia a resposta)
            // Passa o corpo inteiro para o serviço de IA
            iaService.handleMensagem(req.body).catch((error) => {
                console.error("Erro ao processar mensagem no ia.service:", error);
            });

        } catch (error: any) {
            console.error('Erro ao iniciar o ia.service:', error);
            // Mesmo em caso de erro, responder 200 para evitar retentativas desnecessárias
            return res.status(200).send('EVENT_RECEIVED');
        }
    }
}

export default new WebhookController();

