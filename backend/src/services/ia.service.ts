// src/services/ia.service.ts
import { Clinica } from '@prisma/client';
import whatsappService from './whatsapp.service';
// import disponibilidadeService from './disponibilidade.service';
// import pacienteService from './paciente.service'; // (Vamos usar em breve)

class IaService {
  /**
   * Lida com uma nova mensagem de WhatsApp para uma Clínica específica.
   */
  async handleMensagem(mensagemBruta: any, clinica: Clinica) {
    // Extrai as credenciais da clínica
    const { id: clinicaId, whatsappToken, whatsappPhoneId } = clinica;

    try {
      // 1. Parsear a mensagem
      const texto = mensagemBruta.entry[0].changes[0].value.messages[0].text.body;
      const telefone = mensagemBruta.entry[0].changes[0].value.messages[0].from; // ex: 5514999998888

      console.log(`IA: Processando msg de ${telefone} para Clínica ${clinicaId}: ${texto}`);

      // 2. Lógica de IA (Removida a simulação)
      // TODO: Implementar o Agente LangChain + Gemini aqui.
      // O agente receberá o `texto`, `clinicaId`, `telefone`
      // e as ferramentas que criámos em `ia.tools.ts`.

      // A lógica de "if (texto.includes('oi'))" foi removida.
      const resposta = 'TODO: A resposta da LangChain virá aqui.';

      // 3. Responder usando as credenciais da Clínica
      await whatsappService.enviarMensagem(
        telefone,
        resposta,
        whatsappToken as string, // Faz type assertion pois pode ser null
        whatsappPhoneId as string, // Faz type assertion pois pode ser null
      );
    } catch (error: any) {
      console.error(`Erro no processamento da IA para a Clínica ${clinicaId}:`, error.message);
      // (Opcional: Enviar msg de erro ao usuário)
    }
  }
}

export default new IaService();
