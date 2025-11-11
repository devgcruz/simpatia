// src/services/ia.service.ts
import { Clinica } from '@prisma/client';
import whatsappService from './whatsapp.service';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import {
  createListarServicosTool,
  createVerificarDisponibilidadeTool,
  createMarcarAgendamentoTool,
  createAtualizarNomePacienteTool,
  createListarMeusAgendamentosTool,
  createCancelarAgendamentoTool,
} from './ia.tools'; // Importar as factories que criámos
import servicosService from './servicos.service';
import doutorService from './doutor.service';
import pacienteService from './pacientes.service';
import { prisma } from '../lib/prisma';

type SenderTypeValue = 'IA' | 'PACIENTE' | 'DOUTOR';

type StoredChatMessage = {
  content: string;
  senderType: SenderTypeValue;
};

// Função para mapear histórico do DB para formato LangChain
function mapDbMessagesToLangChain(messages: StoredChatMessage[]): BaseMessage[] {
  return messages.map((msg) => {
    if (msg.senderType === 'PACIENTE') {
      return new HumanMessage(msg.content);
    }
    if (msg.senderType === 'IA') {
      try {
        const parsed = JSON.parse(msg.content);
        if (parsed.tool_calls) {
          return new AIMessage({
            content: parsed.content || '',
            tool_calls: parsed.tool_calls,
          });
        }
      } catch (e) {
        // Conteúdo não é JSON válido ou não representa tool calls
      }
      return new AIMessage(msg.content);
    }
    return new AIMessage(msg.content);
  });
}

const SYSTEM_PROMPT = `Você é "Simpatia", uma assistente de IA profissional e amigável.
Sua principal função é ajudar pacientes a marcar consultas numa clínica.

Contexto da Clínica:
- Você está a atender a clínica de ID: {clinicaId}
- O paciente com quem está a falar tem o número de WhatsApp: {telefonePaciente}

--- CATÁLOGO DE DOUTORES (Use para encontrar doutorId) ---
{listaDoutores}
--- FIM CATÁLOGO DE DOUTORES ---

--- CATÁLOGO DE SERVIÇOS (Use para encontrar servicoId) ---
{listaServicos}
--- FIM CATÁLOGO DE SERVIÇOS ---

Suas Tarefas:
Saudar e Ajudar: Seja sempre cordial.

Usar Ferramentas: Você DEVE usar as ferramentas fornecidas para responder a perguntas sobre serviços, verificar horários e marcar agendamentos.

Encontrar IDs: Antes de usar 'verificar_disponibilidade_horarios' ou 'marcar_agendamento_paciente', consulte os catálogos acima para encontrar o 'doutorId' e 'servicoId' correspondentes ao que o paciente pediu.

Recolher Informação: Se o paciente quiser marcar uma consulta mas não fornecer data, serviço ou doutor, você deve perguntar-lhe antes de usar as ferramentas.

Seja Proativa (Serviços): Se o paciente perguntar "Quais serviços vocês têm?", use a ferramenta 'listar_servicos_clinica' em vez de recitar o catálogo (o catálogo acima é apenas para seu contexto interno).

Não Agir sem Ferramenta: Se o pedido for algo que você não pode fazer (ex: "dar diagnóstico médico"), informe educadamente que não pode realizar essa ação.

Capturar Nome do Paciente: O paciente pode ter um nome genérico no sistema (ex: "Paciente 1234"). Após marcar uma consulta com sucesso, pergunte o nome completo do paciente e use a ferramenta 'atualizar_nome_paciente' para salvar.

Listar Agendamentos: Se o paciente perguntar "quais são minhas consultas?" ou "quando é meu agendamento?", use a ferramenta 'listar_meus_agendamentos'.

Cancelar Agendamento: Se o paciente pedir para cancelar uma consulta, você DEVE primeiro usar a ferramenta 'listar_meus_agendamentos' para que o paciente informe o ID exato da consulta. Em seguida, use a ferramenta 'cancelar_agendamento' com esse ID.

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

      const paciente = await pacienteService.getOrCreateByTelefone(telefone, clinicaId);

      const dbHistory = (await (prisma as any).chatMessage.findMany({
        where: { pacienteId: paciente.id },
        orderBy: { createdAt: 'asc' },
        take: 20,
      })) as StoredChatMessage[];
      const history = mapDbMessagesToLangChain(dbHistory);

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
        createAtualizarNomePacienteTool(clinicaId, telefone),
        createListarMeusAgendamentosTool(clinicaId, telefone),
        createCancelarAgendamentoTool(clinicaId, telefone),
      ];

      // 7.5. Carregar contexto da clínica (Doutores e Serviços)
      const [doutores, servicos] = await Promise.all([
        doutorService.getAllParaIA(clinicaId), // O novo método
        servicosService.getAll(clinicaId), // O serviço existente
      ]);

      const formatarDoutores =
        doutores.length > 0
          ? doutores.map((d) => `- ${d.nome} (ID: ${d.id}, Especialidade: ${d.especialidade || 'N/A'})`).join('\n')
          : 'Nenhum doutor cadastrado.';

      const formatarServicos =
        servicos.length > 0
          ? servicos.map((s) => `- ${s.nome} (ID: ${s.id}, Duração: ${s.duracaoMin} min)`).join('\n')
          : 'Nenhum serviço cadastrado.';

      const systemPromptFilled = SYSTEM_PROMPT.replaceAll('{clinicaId}', String(clinicaId))
        .replaceAll('{telefonePaciente}', telefone)
        .replaceAll('{listaDoutores}', formatarDoutores)
        .replaceAll('{listaServicos}', formatarServicos);

      const modelWithTools = llm.bindTools(tools);

      const conversation: BaseMessage[] = [new SystemMessage(systemPromptFilled), ...history];

      const humanMessage = new HumanMessage(texto);
      conversation.push(humanMessage);
      await (prisma as any).chatMessage.create({
        data: {
          content: texto,
          senderType: 'PACIENTE',
          pacienteId: paciente.id,
        },
      });

      const maxIterations = 6;
      let respostaFinal = 'Desculpe, não consegui processar sua solicitação.';
      let finalAiMessage: AIMessage | null = null;

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const aiResponse = (await modelWithTools.invoke(conversation)) as AIMessage;
        finalAiMessage = aiResponse;
        conversation.push(aiResponse);

        await (prisma as any).chatMessage.create({
          data: {
            content: aiResponse.tool_calls ? JSON.stringify(aiResponse) : (aiResponse.content as string),
            senderType: 'IA',
            pacienteId: paciente.id,
          },
        });

        const toolCalls = aiResponse.tool_calls ?? [];

        if (!toolCalls.length) {
          const content = aiResponse.content;
          if (typeof content === 'string') {
            respostaFinal = content;
          } else if (Array.isArray(content)) {
            respostaFinal = content
              .map((part) => (typeof part === 'string' ? part : (part as any).text || ''))
              .join('\n')
              .trim();
          }
          break;
        }

        for (const call of toolCalls) {
          const tool = tools.find((t) => t.name === call.name);
          const toolCallId = call.id ?? `${call.name}_${Date.now()}`;

          if (!tool) {
            const toolErrorMessage = `Ferramenta ${call.name} não disponível no momento.`;
            const toolMessage = new ToolMessage({ content: toolErrorMessage, tool_call_id: toolCallId, status: 'error' });
            conversation.push(toolMessage);
            await (prisma as any).chatMessage.create({
              data: {
                content: toolErrorMessage,
                senderType: 'IA',
                pacienteId: paciente.id,
              },
            });
            continue;
          }

          try {
            const toolInput = (call.args as Record<string, unknown>) ?? {};
            // DynamicStructuredTool espera input conforme schema
            const result = await (tool as unknown as { invoke: (input: unknown) => Promise<unknown> }).invoke(toolInput);
            const resultString =
              typeof result === 'string' ? result : typeof result === 'object' ? JSON.stringify(result) : String(result);

            const toolMessage = new ToolMessage({ content: resultString, tool_call_id: toolCallId });
            conversation.push(toolMessage);
            await (prisma as any).chatMessage.create({
              data: {
                content: resultString,
                senderType: 'IA',
                pacienteId: paciente.id,
              },
            });
          } catch (err: any) {
            const errorMessage = err?.message ?? 'Erro desconhecido ao executar a ferramenta.';
            const toolMessage = new ToolMessage({
              content: `Erro ao executar a ferramenta ${call.name}: ${errorMessage}`,
              tool_call_id: toolCallId,
              status: 'error',
            });
            conversation.push(toolMessage);
            await (prisma as any).chatMessage.create({
              data: {
                content: `Erro na ferramenta ${call.name}: ${errorMessage}`,
                senderType: 'IA',
                pacienteId: paciente.id,
              },
            });
          }
        }
      }

      if (!finalAiMessage) {
        throw new Error('O modelo não retornou uma resposta.');
      }

      // Histórico agora persistido no banco de dados

      // 10. Responder ao usuário via WhatsApp
      await whatsappService.enviarMensagem(
        telefone, 
        respostaFinal,
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
