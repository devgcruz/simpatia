// src/services/ia.service.ts
import { Clinica } from '@prisma/client';
import whatsappService from './whatsapp.service';
// import disponibilidadeService from './disponibilidade.service';
// import pacienteService from './paciente.service'; // (Vamos usar em breve)
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import {
  createListarServicosTool,
  createVerificarDisponibilidadeTool,
  createMarcarAgendamentoTool,
} from './ia.tools'; // Importar as factories que criámos

// Armazenamento de histórico em memória (simples para este exemplo)
// Em produção, isto seria um Redis ou um banco de dados
const chatHistories = new Map<string, BaseMessage[]>();

const SYSTEM_PROMPT = `Você é "Simpatia", uma assistente de IA profissional e amigável.
Sua principal função é ajudar pacientes a marcar consultas numa clínica.

Contexto da Clínica:
- Você está a atender a clínica de ID: {clinicaId}
- O paciente com quem está a falar tem o número de WhatsApp: {telefonePaciente}

Suas Tarefas:
1.  **Saudar e Ajudar:** Seja sempre cordial.
2.  **Usar Ferramentas:** Você DEVE usar as ferramentas fornecidas para responder a perguntas sobre serviços, verificar horários e marcar agendamentos.
3.  **Recolher Informação:** Se o paciente quiser marcar uma consulta mas não fornecer data, serviço ou doutor, você deve perguntar-lhe *antes* de usar as ferramentas.
4.  **Confirmar IDs:** O paciente não saberá os IDs (doutorId, servicoId). Se a intenção for marcar, primeiro use a ferramenta "listar_servicos_clinica" para que o paciente possa escolher. (NOTA: Se a IA precisar dos IDs para as outras ferramentas, ela deve pedi-los).
5.  **Não Agir sem Ferramenta:** Se o pedido for algo que você não pode fazer (ex: "dar diagnóstico médico", "cancelar consulta"), informe educadamente que não pode realizar essa ação.

Instruções Importantes:
- Responda sempre em Português do Brasil.
- Mantenha as respostas curtas e diretas, adequadas para WhatsApp.
- O histórico da conversa (chat_history) está disponível. Use-o para manter o contexto.`;

class IaService {
  /**
   * Lida com uma nova mensagem de WhatsApp para uma Clínica específica.
   */
  async handleMensagem(mensagemBruta: any, clinica: Clinica) {
    const { id: clinicaId, whatsappToken, whatsappPhoneId } = clinica;

    try {
      // 1. Parsear a mensagem
      const texto = mensagemBruta.entry[0].changes[0].value.messages[0].text.body;
      const telefone = mensagemBruta.entry[0].changes[0].value.messages[0].from; // ex: 5514999998888

      console.log(`IA: Processando msg de ${telefone} para Clínica ${clinicaId}: ${texto}`);

      // 2. Obter histórico da sessão
      const history = chatHistories.get(telefone) || [];

      // 3. Criar o Prompt do Agente
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', SYSTEM_PROMPT],
        new MessagesPlaceholder('chat_history'),
        ['human', '{input}'],
        new MessagesPlaceholder('agent_scratchpad'),
      ]);

      // 4. Inicializar o Modelo (Gemini)
      // Certifique-se que GOOGLE_API_KEY está no .env
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_API_KEY não configurado no ambiente.');
      }

      const llm = new ChatGoogleGenerativeAI({
        apiKey,
        model: 'gemini-1.5-flash-latest',
        temperature: 0,
      });

      // 5. Inicializar as Ferramentas (agora com o contexto!)
      const tools = [
        createListarServicosTool(clinicaId),
        createVerificarDisponibilidadeTool(clinicaId),
        createMarcarAgendamentoTool(clinicaId, telefone),
      ];

      // 6. Criar o Agente
      const agent = await createToolCallingAgent({ llm, tools, prompt });

      // 7. Criar o Executor do Agente (que lida com a lógica de chamar as ferramentas)
      const agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: process.env.NODE_ENV === 'development', // Mostra logs detalhados em dev
      });

      // 8. Invocar o Agente
      const result = await agentExecutor.invoke({
        input: texto,
        chat_history: history,
        // Passa as variáveis de contexto para o SYSTEM_PROMPT
        clinicaId: clinicaId,
        telefonePaciente: telefone,
      });

      // A resposta final da IA
      const resposta = result.output;

      // 9. Atualizar o histórico
      history.push(new HumanMessage(texto));
      history.push(new AIMessage(resposta));
      chatHistories.set(telefone, history);

      // 10. Responder ao usuário via WhatsApp
      await whatsappService.enviarMensagem(
        telefone,
        resposta,
        whatsappToken as string,
        whatsappPhoneId as string,
      );
    } catch (error: any) {
      console.error(`Erro no processamento da IA para a Clínica ${clinicaId}:`, error.message, error.stack);
      // Tenta enviar uma mensagem de erro ao usuário se possível
      try {
        const telefone = mensagemBruta.entry[0].changes[0].value.messages[0].from;
        await whatsappService.enviarMensagem(
          telefone,
          'Ops! Desculpe, tive um problema técnico. Tente novamente em alguns instantes.',
          whatsappToken as string,
          whatsappPhoneId as string,
        );
      } catch (e) {
        console.error('Erro ao enviar mensagem de erro da IA:', e);
      }
    }
  }
}

export default new IaService();
