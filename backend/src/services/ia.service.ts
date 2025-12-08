import { ChatMessage, Clinica, Paciente, SenderType } from '@prisma/client';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { prisma } from '../lib/prisma';
import whatsappService from './whatsapp.service';
import pacienteService from './pacientes.service';
import servicosService from './servicos.service';
import doutorService from './doutor.service';
import {
  createAtualizarNomePacienteTool,
  createCancelarAgendamentoTool,
  createClassificarSintomaTool,
  createHandoffTool,
  createListarMeusAgendamentosTool,
  createListarServicosTool,
  createMarcarAgendamentoTool,
  createVerificarDisponibilidadeTool,
} from './ia.tools';
import { buildIaGraph, GraphState } from './ia.graph';

function unwrapAiContent(content: string | any[]): string {
  if (typeof content === 'string') {
    if (content.trim() === '') return '';
    try {
      const parsed = JSON.parse(content);
      if (parsed.lc === 1 && parsed.kwargs?.content) {
        return unwrapAiContent(parsed.kwargs.content);
      }
      return content;
    } catch {
      return content;
    }
  }
  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const part of content) {
      if (typeof part === 'string') {
        textParts.push(part);
      } else if (part?.type === 'text' && part.text) {
        textParts.push(part.text);
      }
    }
    return textParts.join('\n').trim();
  }
  return String(content || '');
}

function detectarUrgencia(texto: string): boolean {
  const textoLower = texto.toLowerCase().trim();
  const palavrasUrgencia = [
    'urgente',
    'urgência',
    'emergência',
    'emergencia',
    'emergente',
    'dor forte',
    'dor intensa',
    'muita dor',
    'dor insuportável',
    'sangrando',
    'sangramento',
    'sangue',
    'acidente',
    'quedou',
    'caiu',
    'bateu',
    'não consigo',
    'não aguento',
    'preciso urgente',
    'muito mal',
    'muito ruim',
    'piorando',
    'febre alta',
    'febre muito alta',
    'dificuldade para respirar',
    'não consigo respirar',
    'desmaio',
    'desmaiou',
    'tonto',
    'tontura',
    'convulsão',
    'convulsao',
  ];
  return palavrasUrgencia.some((p) => textoLower.includes(p));
}

const buildSystemPrompt = ({
  clinicaId,
  telefonePaciente,
  listaDoutores,
  listaServicos,
  dataHojeBR,
  dataHojeISO,
}: {
  clinicaId: number;
  telefonePaciente: string;
  listaDoutores: string;
  listaServicos: string;
  dataHojeBR: string;
  dataHojeISO: string;
}) => `
Você é SIMPATIA, um assistente orquestrador de agendamentos. Sua missão é preencher o estado AgendamentoState ao longo da conversa. Objetivo: coletar e confirmar nesta ordem: (1) Sintoma/necessidade → (2) Serviço e Doutor adequados → (3) Data/Hora → (4) Confirmação do agendamento.

Contexto da clínica:
- Clínica ID: ${clinicaId}
- Paciente WhatsApp: ${telefonePaciente}
- Data de hoje: ${dataHojeBR} (ISO: ${dataHojeISO}). Sempre interprete datas relativas ("amanhã", "sexta") com base nessa data.

Catálogo de Doutores:
${listaDoutores || 'Nenhum doutor cadastrado.'}

Catálogo de Serviços:
${listaServicos || 'Nenhum serviço cadastrado.'}

Instruções de orquestração:
- Use as ferramentas disponíveis para obter dados reais (classificar_sintoma_para_servico, verificar_disponibilidade_horarios, marcar_agendamento_paciente, atualizar_nome_paciente, listar_servicos_clinica, listar_meus_agendamentos, cancelar_agendamento, solicitar_atendimento_humano).
- Não invente horários, IDs ou dados clínicos. Sempre consulte ferramentas.
- Calcule datas relativas usando a data atual informada.
- Mantenha o tom humano, breve e claro (1–3 frases).
- Se precisar de mais contexto, pergunte de forma objetiva.
`;

class IaService {
  async handleMensagem(mensagemBruta: any, clinica: Clinica) {
    const { id: clinicaId, whatsappToken, whatsappPhoneId } = clinica;

    const messageObject = mensagemBruta?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!messageObject || messageObject.type !== 'text') {
      console.log('IA: Ignorando evento não-texto.');
      return;
    }

    const texto = messageObject.text.body;
    const telefone = messageObject.from;
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY não configurado no ambiente.');

    const paciente: Paciente = await pacienteService.getOrCreateByTelefone(telefone, clinicaId);

    if (paciente.chatStatus === 'HANDOFF' || detectarUrgencia(texto)) {
      await prisma.chatMessage.create({
        data: { content: texto, senderType: SenderType.PACIENTE, pacienteId: paciente.id },
      });
      if (paciente.chatStatus !== 'HANDOFF') {
        await prisma.paciente.update({ where: { id: paciente.id }, data: { chatStatus: 'HANDOFF' } });
        await whatsappService.enviarMensagem(
          telefone,
          'Entendi que é uma situação urgente. Vou transferir você imediatamente para um de nossos profissionais.',
          whatsappToken as string,
          whatsappPhoneId as string,
        );
        await prisma.chatMessage.create({
          data: {
            content: 'Entendi que é uma situação urgente. Vou transferir você imediatamente para um de nossos profissionais.',
            senderType: SenderType.IA,
            pacienteId: paciente.id,
          },
        });
      }
      return;
    }

    const dbHistory = await prisma.chatMessage.findMany({
      where: { pacienteId: paciente.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const history = mapDbMessagesToLangChain(dbHistory);

    const [doutores, servicos] = await Promise.all([
      doutorService.getAllParaIA(clinicaId),
      servicosService.getAll(clinicaId),
    ]);

    const listaDoutores = doutores
      .map((d) => `- ${d.nome} (ID: ${d.id}${d.especialidade ? `, Especialidade: ${d.especialidade}` : ''})`)
      .join('\n');
    const listaServicos = servicos
      .map((s) => `- ${s.nome} (ID: ${s.id}, Duração: ${s.duracaoMin} min)`)
      .join('\n');

    const hoje = new Date();
    const dataHojeBR = hoje.toLocaleDateString('pt-BR');
    const dataHojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(
      hoje.getDate(),
    ).padStart(2, '0')}`;

    const systemPrompt = buildSystemPrompt({
      clinicaId,
      telefonePaciente: telefone,
      listaDoutores,
      listaServicos,
      dataHojeBR,
      dataHojeISO,
    });

    const model = new ChatGoogleGenerativeAI({
      apiKey,
      model: 'gemini-1.5-pro',
      temperature: 0.2,
    });

    const tools = [
      createClassificarSintomaTool(clinicaId),
      createListarServicosTool(clinicaId),
      createVerificarDisponibilidadeTool(clinicaId),
      createMarcarAgendamentoTool(clinicaId, telefone),
      createAtualizarNomePacienteTool(clinicaId, telefone),
      createListarMeusAgendamentosTool(clinicaId, telefone),
      createCancelarAgendamentoTool(clinicaId, telefone),
      createHandoffTool(paciente.id),
    ];

    const graph = buildIaGraph(model, tools);

    const initialState: GraphState = {
      step: 'SAUDACAO',
      paciente: { nome: paciente.nome || null, telefone },
      intencao: { servicoId: null, doutorId: null, dataDesejada: null },
      ultimoErro: null,
      messages: [new SystemMessage(systemPrompt), ...history, new HumanMessage(texto)],
    };

    await prisma.chatMessage.create({
      data: { content: texto, senderType: SenderType.PACIENTE, pacienteId: paciente.id },
    });

    const result = (await graph.invoke(initialState as any, {
      configurable: { thread_id: paciente.id.toString() },
    })) as any;

    const finalMessages = result.messages as BaseMessage[];
    const finalMsg = finalMessages[finalMessages.length - 1];
    const respostaFinal =
      finalMsg instanceof AIMessage ? unwrapAiContent(finalMsg.content) : unwrapAiContent(String(finalMsg));

    await prisma.chatMessage.create({
      data: { content: respostaFinal, senderType: SenderType.IA, pacienteId: paciente.id },
    });

    await whatsappService.enviarMensagem(
      telefone,
      respostaFinal,
      whatsappToken as string,
      whatsappPhoneId as string,
    );
  }
}

function mapDbMessagesToLangChain(messages: ChatMessage[]): BaseMessage[] {
  const history: BaseMessage[] = [];
  for (const msg of messages) {
    if (msg.senderType === 'PACIENTE') {
      history.push(new HumanMessage(msg.content));
    } else if (msg.senderType === 'IA') {
      try {
        const aiMsg = JSON.parse(msg.content);
        if (aiMsg.tool_calls) {
          history.push(
            new AIMessage({
              content: aiMsg.content || '',
              tool_calls: aiMsg.tool_calls,
            }),
          );
          continue;
        }
      } catch {
        /* ignore */
      }
      history.push(new AIMessage(msg.content));
    } else if ((msg.senderType as string) === 'TOOL') {
      const msgWithTool = msg as any;
      history.push(
        new ToolMessage({
          content: msg.content,
          tool_call_id: msgWithTool.tool_call_id || '',
          name: msgWithTool.tool_name || '',
        }),
      );
    } else {
      history.push(new HumanMessage(msg.content));
    }
  }
  return history;
}

export default new IaService();

