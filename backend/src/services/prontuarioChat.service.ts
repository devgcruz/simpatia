import { prisma } from '../lib/prisma';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { SenderType } from '@prisma/client';

interface AuthUser {
  id: number;
  role: 'DOUTOR' | 'CLINICA_ADMIN' | 'SUPER_ADMIN';
  clinicaId: number | null;
}

type ProntuarioChatMessageEntity = {
  id: number;
  agendamentoId: number;
  sender: SenderType;
  content: string;
  createdAt: Date;
};

class ProntuarioChatService {
  private async getAgendamentoOrThrow(agendamentoId: number) {
    const agendamento = await prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      include: {
        paciente: {
          select: {
            id: true,
            nome: true,
            cpf: true,
            alergias: true,
            observacoes: true,
            genero: true,
            dataNascimento: true,
            pesoKg: true,
            alturaCm: true,
          },
        },
        doutor: {
          select: {
            id: true,
            nome: true,
            clinicaId: true,
            clinica: {
              select: {
                id: true,
                nome: true,
                endereco: true,
                telefone: true,
              },
            },
          },
        },
        servico: {
          select: {
            id: true,
            nome: true,
            duracaoMin: true,
          },
        },
      },
    });

    if (!agendamento) {
      throw new Error('Agendamento não encontrado.');
    }

    return agendamento;
  }

  private ensureAccess(agendamento: any, user: AuthUser) {
    if (user.role === 'DOUTOR' && agendamento.doutorId !== user.id) {
      throw new Error('Acesso negado.');
    }
    if (user.role === 'CLINICA_ADMIN') {
      if (!user.clinicaId || agendamento.doutor.clinicaId !== user.clinicaId) {
        throw new Error('Acesso negado.');
      }
    }
  }

  async listMessages(agendamentoId: number, user: AuthUser) {
    const agendamento = await this.getAgendamentoOrThrow(agendamentoId);
    this.ensureAccess(agendamento, user);

    const messages = await prisma.prontuarioChatMessage.findMany({
      where: { agendamentoId },
      orderBy: { createdAt: 'asc' },
    });

    return messages;
  }

  async sendMessage(agendamentoId: number, content: string, user: AuthUser) {
    if (!content || !content.trim()) {
      throw new Error('Mensagem obrigatória.');
    }

    const agendamento = await this.getAgendamentoOrThrow(agendamentoId);
    this.ensureAccess(agendamento, user);

    const existingMessages: ProntuarioChatMessageEntity[] = await prisma.prontuarioChatMessage.findMany({
      where: { agendamentoId },
      orderBy: { createdAt: 'asc' },
    });

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY não configurada no servidor.');
    }

    const llm = new ChatGoogleGenerativeAI({
      apiKey,
      model: 'gemini-2.5-flash-lite',
      temperature: 0.4,
    });

    const alergias = agendamento.paciente.alergias
      ? agendamento.paciente.alergias.split(',').map((a: string) => a.trim()).filter(Boolean)
      : [];
    const idadePaciente = agendamento.paciente.dataNascimento
      ? Math.max(0, Math.floor((Date.now() - new Date(agendamento.paciente.dataNascimento).getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
      : null;
    const pesoPaciente = agendamento.paciente.pesoKg ?? null;
    const alturaPacienteCm = agendamento.paciente.alturaCm ?? null;
    const imcPaciente =
      pesoPaciente && alturaPacienteCm && alturaPacienteCm > 0
        ? pesoPaciente / Math.pow(alturaPacienteCm / 100, 2)
        : null;

    const systemPrompt = [
      'Você é um agente clínico (Gemini) que auxilia médicos durante o atendimento.',
      'Responda sempre em Português do Brasil, de forma objetiva, técnica e cordial.',
      'Nunca faça diagnósticos definitivos ou prescrições sem orientação do médico.',
      'Forneça sugestões, referências e hipóteses com responsabilidade.',
      'Contexto do agendamento:',
      `- Paciente: ${agendamento.paciente.nome}${agendamento.paciente.cpf ? ` (CPF: ${agendamento.paciente.cpf})` : ''}`,
      `- Serviço: ${agendamento.servico.nome} (${agendamento.servico.duracaoMin} min)`,
      `- Data/Hora: ${agendamento.dataHora.toLocaleString('pt-BR')}`,
      `- Alergias: ${alergias.length ? alergias.join(', ') : 'Nenhuma informada'}`,
      agendamento.paciente.observacoes ? `- Observações do prontuário: ${agendamento.paciente.observacoes}` : '',
      agendamento.relatoPaciente ? `- Relato do paciente: ${agendamento.relatoPaciente}` : '',
      agendamento.entendimentoIA ? `- Análise inicial da IA: ${agendamento.entendimentoIA}` : '',
      `- Dados antropométricos: Idade ${idadePaciente !== null ? `${idadePaciente} anos` : 'não informada'}, Sexo ${
        agendamento.paciente.genero || 'não informado'
      }, Peso ${pesoPaciente !== null ? `${pesoPaciente.toFixed(1)} kg` : 'não informado'}, Altura ${
        alturaPacienteCm !== null ? `${(alturaPacienteCm / 100).toFixed(2)} m` : 'não informada'
      }, IMC ${imcPaciente !== null ? imcPaciente.toFixed(1) : 'não calculado'}`,
      '',
      'Utilize o histórico a seguir para manter o contexto do chat.',
    ].filter(Boolean).join('\n');

    const history = existingMessages.map((message: ProntuarioChatMessageEntity) => {
      if (message.sender === SenderType.DOUTOR) {
        return new HumanMessage(message.content);
      }
      return new AIMessage(message.content);
    });

    const conversation = [
      new SystemMessage(systemPrompt),
      ...history,
      new HumanMessage(content.trim()),
    ];

    const aiResponse = await llm.invoke(conversation);
    const aiText = Array.isArray(aiResponse.content)
      ? aiResponse.content.map((part: any) => part.text ?? '').join(' ').trim()
      : (aiResponse.content as string);

    const parsedAiText = aiText || 'Não consegui gerar uma resposta no momento.';

    await prisma.$transaction([
      prisma.prontuarioChatMessage.create({
        data: {
          agendamentoId,
          sender: SenderType.DOUTOR,
          content: content.trim(),
        },
      }),
      prisma.prontuarioChatMessage.create({
        data: {
          agendamentoId,
          sender: SenderType.IA,
          content: parsedAiText,
        },
      }),
    ]);

    return this.listMessages(agendamentoId, user);
  }
}

export default new ProntuarioChatService();

