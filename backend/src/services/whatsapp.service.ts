// src/services/whatsapp.service.ts
import axios from 'axios';

class WhatsAppService {

  /**
   * Envia uma mensagem de texto via API Oficial do WhatsApp.
   * Agora recebe as credenciais da clínica como parâmetros.
   */
  async enviarMensagem(
    telefone: string, 
    mensagem: string, 
    whatsappToken: string, 
    whatsappPhoneId: string
  ) {

    // Se as credenciais da clínica não estiverem configuradas, não podemos enviar.
    if (!whatsappToken || !whatsappPhoneId) {
      console.error(`Tentativa de enviar mensagem para ${telefone} falhou: Token ou PhoneId não configurados para esta clínica.`);
      return;
    }

    const url = `https://graph.facebook.com/v19.0/${whatsappPhoneId}/messages`;

    const data = {
      messaging_product: 'whatsapp',
      to: "55" + telefone, // Assume DDI do Brasil.
      type: 'text',
      text: { body: mensagem },
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
    };

    try {
      await axios.post(url, data, config);
      console.log(`Mensagem enviada para: ${telefone}`);
    } catch (error: any) {
      console.error(`Erro ao enviar mensagem para ${telefone}:`, error.response?.data || error.message);
    }
  }
}

export default new WhatsAppService();

