// Ficheiro: backend/src/services/ia.service.ts
import { ChatMessage, Clinica, Paciente, SenderType } from '@prisma/client';
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
  createHandoffTool,
} from './ia.tools';
import servicosService from './servicos.service';
import doutorService from './doutor.service';
import { prisma } from '../lib/prisma';
import pacienteService from './pacientes.service';

// --- INÍCIO DA CORREÇÃO (FUNÇÃO HELPER) ---
/**
 * Desembrulha recursivamente o conteúdo de uma AIMessage que pode estar
 * serializada como JSON dentro de outra AIMessage.
 */
function unwrapAiContent(content: string | any[]): string {
  if (typeof content === 'string') {
    try {
      // Tenta analisar o JSON
      const parsedContent = JSON.parse(content);

      // Verifica se é um objeto LangChain AIMessage serializado
      if (parsedContent.lc === 1 && parsedContent.kwargs && parsedContent.kwargs.content) {
        // Se for, mergulha mais fundo
        return unwrapAiContent(parsedContent.kwargs.content);
      }
      // Se for JSON mas não o que esperamos, retorna a string original
      return content;
    } catch (e) {
      // Não é JSON, é a string final que queremos!
      return content;
    }
  }
  // Lida com o caso de array (visto no seu código)
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : (part as any).text || ''))
      .join('\n')
      .trim();
  }
  // Fallback
  return String(content || 'Desculpe, não entendi.');
}
// --- FIM DA CORREÇÃO ---

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

Usar Ferramentas: Você DEVE usar as ferramentas fornecidas.

Encontrar IDs: Antes de usar 'verificar_disponibilidade_horarios' ou 'marcar_agendamento_paciente', consulte os catálogos acima para encontrar o 'doutorId' e 'servicoId' correspondentes.

Recolher Informação: Se o paciente quiser marcar uma consulta mas não fornecer data, serviço ou doutor, você deve perguntar-lhe.

Serviços vs Especialidades: Trate perguntas sobre "especialidades" da mesma forma que "serviços". Use a ferramenta 'listar_servicos_clinica'.

Seja Proativa (Serviços): Se o paciente perguntar "Quais serviços vocês têm?" ou "Quais especialidades?", use a ferramenta 'listar_servicos_clinica'.

Não Agir sem Ferramenta: Se o pedido for algo que você não pode fazer (ex: "dar diagnóstico médico"), informe educadamente que não pode realizar essa ação.

Capturar Nome do Paciente: Após marcar uma consulta com sucesso, pergunte o nome completo do paciente e use a ferramenta 'atualizar_nome_paciente'.

Listar Agendamentos: Se o paciente perguntar "quais são minhas consultas?", use a ferramenta 'listar_meus_agendamentos'.

Cancelar Agendamento: Se o paciente pedir para cancelar, use 'listar_meus_agendamentos' para ele confirmar o ID, e depois use 'cancelar_agendamento'.

Transferir para Humano: Se o paciente pedir para "falar com um atendente", use a ferramenta 'solicitar_atendimento_humano'.

Instruções Importantes:
- Responda sempre em Português do Brasil.
- Mantenha as respostas curtas e diretas, adequadas para WhatsApp.
- O histórico da conversa (chat_history) está disponível.`;

class IaService {
  async handleMensagem(mensagemBruta: any, clinica: Clinica) {
    const { id: clinicaId, whatsappToken, whatsappPhoneId } = clinica;
    let paciente: Paciente;

    try {
      // 1. Parsear a mensagem (COM FILTRO DE SEGURANÇA)
      const messageObject = mensagemBruta?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!messageObject || messageObject.type !== 'text') {
        console.log(`IA: Ignorando evento de status (não-texto) da Meta.`);
        return;
      }
      const texto = messageObject.text.body;
      const telefone = messageObject.from;
      console.log(`IA: Processando msg de ${telefone} para Clínica ${clinicaId}: ${texto}`);

      // 1.5. Garantir que o paciente existe ANTES de tudo
      paciente = await pacienteService.getOrCreateByTelefone(telefone, clinicaId);

      // VERIFICAÇÃO DE HANDOFF
      if (paciente.chatStatus === 'HANDOFF') {
        console.log(`IA: Mensagem ignorada (Handoff) de ${telefone}`);
        await prisma.chatMessage.create({
          data: { content: texto, senderType: SenderType.PACIENTE, pacienteId: paciente.id },
        });
        return;
      }

      // 2. Obter histórico da sessão DO BANCO DE DADOS
      const dbHistory = await prisma.chatMessage.findMany({
        where: { pacienteId: paciente.id },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      const history = mapDbMessagesToLangChain(dbHistory);

      // 4. Inicializar o Modelo (Gemini)
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_API_KEY não configurado no ambiente.');
      }
      const llm = new ChatGoogleGenerativeAI({
        apiKey,
        model: 'gemini-2.5-pro', // Usando o modelo estável
        temperature: 0,
      });

      // 5. Inicializar as Ferramentas
      const tools = [
        createListarServicosTool(clinicaId),
        createVerificarDisponibilidadeTool(clinicaId),
        createMarcarAgendamentoTool(clinicaId, telefone),
        createAtualizarNomePacienteTool(clinicaId, telefone),
        createListarMeusAgendamentosTool(clinicaId, telefone),
        createCancelarAgendamentoTool(clinicaId, telefone),
        createHandoffTool(paciente.id),
      ];

      // 7.5. Carregar contexto da clínica
      const [doutores, servicos] = await Promise.all([
        doutorService.getAllParaIA(clinicaId),
        servicosService.getAll(clinicaId),
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
      await prisma.chatMessage.create({
        data: { content: texto, senderType: SenderType.PACIENTE, pacienteId: paciente.id },
      });

      const maxIterations = 6;
      let respostaFinal = 'Desculpe, não consegui processar sua solicitação.';
      let finalAiMessage: AIMessage | null = null;

      // --- INÍCIO DO LOOP CORRIGIDO ---
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const aiResponse = (await modelWithTools.invoke(conversation)) as AIMessage;
        finalAiMessage = aiResponse;
        conversation.push(aiResponse);
        const toolCalls = aiResponse.tool_calls ?? [];
        let contentToSave: string; // Variável para guardar no DB

        if (!toolCalls.length) {
          // É uma resposta de TEXTO
          respostaFinal = unwrapAiContent(aiResponse.content); // Limpa o JSON
          contentToSave = respostaFinal; // O texto limpo

          // Guarda o TEXTO LIMPO no DB
          await prisma.chatMessage.create({
            data: {
              content: contentToSave,
              senderType: SenderType.IA,
              pacienteId: paciente.id,
            },
          });
          break; // Sai do loop
        } else {
          // É uma CHAMADA DE FERRAMENTA
          contentToSave = JSON.stringify(aiResponse); // Guarda o JSON da *chamada*

          // Guarda a CHAMADA DE FERRAMENTA no DB
          await prisma.chatMessage.create({
            data: {
              content: contentToSave,
              senderType: SenderType.IA,
              pacienteId: paciente.id,
            },
          });
        }

        // Processamento das Ferramentas
        for (const call of toolCalls) {
          const tool = tools.find((t) => t.name === call.name);
          const toolCallId = call.id ?? `${call.name}_${Date.now()}`;

          if (!tool) {
            const toolErrorMessage = `Ferramenta ${call.name} não disponível no momento.`;
            const toolMessage = new ToolMessage({
              content: toolErrorMessage,
              tool_call_id: toolCallId,
              status: 'error',
            });
            conversation.push(toolMessage);
            continue;
          }

          try {
            const toolInput = (call.args as Record<string, unknown>) ?? {};
            const result = await (tool as unknown as { invoke: (input: unknown) => Promise<unknown> }).invoke(
              toolInput,
            );
            const resultString =
              typeof result === 'string' ? result : typeof result === 'object' ? JSON.stringify(result) : String(result);
            const toolMessage = new ToolMessage({ content: resultString, tool_call_id: toolCallId });
            conversation.push(toolMessage);

            // Grava o resultado da ferramenta no DB
            await prisma.chatMessage.create({
              data: {
                content: resultString,
                senderType: SenderType.IA, // Ou um novo SenderType.TOOL
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

            // Grava o erro da ferramenta no DB
            await prisma.chatMessage.create({
              data: {
                content: `Erro na ferramenta ${call.name}: ${errorMessage}`,
                senderType: SenderType.IA,
                pacienteId: paciente.id,
              },
            });
          }
        }
      }
      // --- FIM DO LOOP CORRIGIDO ---

      if (!finalAiMessage) {
        throw new Error('O modelo não retornou uma resposta.');
      }

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
        const telefone = mensagemBruta?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

        if (telefone && whatsappToken && whatsappPhoneId) {
          await whatsappService.enviarMensagem(
            telefone,
            'Ops! Desculpe, tive um problema técnico. Tente novamente em alguns instantes.',
            whatsappToken as string,
            whatsappPhoneId as string,
          );
        }
      } catch (e) {
        console.error('Erro ao enviar mensagem de erro da IA:', e);
      }
    }
  }
}

// Função para mapear histórico do DB para formato LangChain (Adicione se não existir)
function mapDbMessagesToLangChain(messages: ChatMessage[]): BaseMessage[] {
  return messages.map((msg) => {
    if (msg.senderType === 'PACIENTE') {
      return new HumanMessage(msg.content);
    }
    if (msg.senderType === 'IA') {
      try {
        const aiMsg = JSON.parse(msg.content);
        if (aiMsg.tool_calls) {
          return new AIMessage({
            content: aiMsg.content || '',
            tool_calls: aiMsg.tool_calls,
          });
        }
        // Se for um resultado de ferramenta (JSON não-AIMessage)
        if (aiMsg.tool_call_id) {
          return new ToolMessage(aiMsg.content, aiMsg.tool_call_id);
        }
      } catch (e) {
        // Não é JSON, é uma resposta de texto simples
      }
      return new AIMessage(msg.content);
    }
    // Fallback para DOUTOR ou outros tipos
    return new HumanMessage(msg.content); // Trata a msg do Doutor como "humana" no histórico
  });
}

export default new IaService();
