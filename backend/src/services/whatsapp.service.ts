import axios from 'axios';

class WhatsAppService {

    async enviarMensagem(telefone: string, mensagem: string) {
        try {
            const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
            const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

            if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
                throw new Error("WHATSAPP_TOKEN e WHATSAPP_PHONE_ID devem estar configurados no .env");
            }

            // Adicionar DDI do Brasil (55) ao telefone
            const telefoneComDDI = "55" + telefone;

            const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`;

            const response = await axios.post(
                url,
                {
                    messaging_product: "whatsapp",
                    to: telefoneComDDI,
                    type: "text",
                    text: {
                        body: mensagem
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Mensagem enviada com sucesso:', response.data);
            return response.data;

        } catch (error: any) {
            console.error('Erro ao enviar mensagem via WhatsApp:', error.response?.data || error.message);
            throw error;
        }
    }
}

export default new WhatsAppService();

