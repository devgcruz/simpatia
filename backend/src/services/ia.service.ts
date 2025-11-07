// src/services/ia.service.ts
import { Clinica } from '@prisma/client';
import whatsappService from './whatsapp.service';
import disponibilidadeService from './disponibilidade.service';
// import pacienteService from './paciente.service'; // (Vamos usar em breve)

class IaService {

  /**
   * Lida com uma nova mensagem de WhatsApp para uma Clínica específica.
   */
  async handleMensagem(mensagemBruta: any, clinica: Clinica) {

    // Extrai as credenciais da clínica
    const { id: clinicaId, whatsappToken, whatsappPhoneId } = clinica;

    try {
      // 1. Parsear a mensagem (simplificado)
      // (Esta estrutura pode mudar se não for uma msg de texto simples)
      const texto = mensagemBruta.entry[0].changes[0].value.messages[0].text.body;
      const telefone = mensagemBruta.entry[0].changes[0].value.messages[0].from; // ex: 5514999998888

      console.log(`IA: Processando msg de ${telefone} para Clínica ${clinicaId}: ${texto}`);

      // 2. Lógica de IA (Simulada por enquanto)
      // TODO: Implementar LangChain e Gemini aqui
      let resposta = "";

      if (texto.toLowerCase().includes("oi")) {
        resposta = "Olá! 👋 Sou a assistente virtual da Clínica. Como posso ajudar?";
      } else if (texto.toLowerCase().includes("horários")) {

        // TODO: Precisamos extrair o doutorId e servicoId da mensagem
        const doutorId = 1; // Ex: Fixo por enquanto
        const servicoId = 1; // Ex: Fixo por enquanto
        const data = '2025-11-07'; // Ex: Fixo por enquanto

        try {
          // USA A NOVA FERRAMENTA MULTI-TENANT (do Passo 9)
          const horarios = await disponibilidadeService.getDisponibilidadeParaIA(
            clinicaId,
            doutorId,
            servicoId,
            data
          );
          resposta = `Os horários livres para o dia ${data} são: ${horarios.join(', ')}`;
        } catch (error: any) {
          resposta = "Desculpe, não consegui verificar os horários. Tente mais tarde.";
        }

      } else {
        resposta = "Desculpe, não entendi. Estou aprendendo!";
      }

      // 3. Responder usando as credenciais da Clínica (do Passo 8)
      await whatsappService.enviarMensagem(
        telefone, 
        resposta, 
        whatsappToken as string, // Faz type assertion pois pode ser null
        whatsappPhoneId as string // Faz type assertion pois pode ser null
      );

    } catch (error: any) {
      console.error(`Erro no processamento da IA para a Clínica ${clinicaId}:`, error.message);
      // (Opcional: Enviar msg de erro ao usuário)
      // await whatsappService.enviarMensagem(telefone, "Ops, algo deu errado.", ...);
    }
  }
}

export default new IaService();

