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

    // Buscar todos os agendamentos do paciente para contexto (apenas ativos)
    const todosAgendamentosRaw = await prisma.agendamento.findMany({
      where: {
        pacienteId: agendamento.pacienteId,
        ativo: true,
      },
      include: {
        servico: {
          select: {
            nome: true,
            duracaoMin: true,
          },
        },
        doutor: {
          select: {
            nome: true,
          },
        },
        historicos: {
          orderBy: {
            realizadoEm: 'desc',
          },
        },
        prescricoes: {
          select: {
            id: true,
            protocolo: true,
            conteudo: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        dataHora: 'desc',
      },
    });

    const todosAgendamentos = todosAgendamentosRaw as any[];

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

    // Formatar histórico de agendamentos para contexto (resumo muito conciso)
    const historicoAgendamentos = todosAgendamentos.map((ag, index) => {
      const dataHora = new Date(ag.dataHora);
      const dataFormatada = dataHora.toLocaleDateString('pt-BR');
      const historico = ag.historicos && ag.historicos.length > 0 ? ag.historicos[0] : null;
      const prescricoes = ag.prescricoes && ag.prescricoes.length > 0 ? ag.prescricoes : [];
      
      let info = `\nAtendimento #${ag.id} (${dataFormatada}):\n`;
      
      if (historico) {
        // Extrair primeiro medicamento da primeira prescrição para resumo
        let primeiroMedicamento = '';
        if (prescricoes.length > 0 && prescricoes[0].conteudo) {
          const primeiraLinha = prescricoes[0].conteudo.split('\n')[0].trim();
          primeiroMedicamento = primeiraLinha.length > 40 ? primeiraLinha.substring(0, 40) + '...' : primeiraLinha;
        }
        
        // Criar resumo muito conciso da descrição (apenas primeiras 8 palavras para identificar o problema)
        const palavrasDescricao = historico.descricao.split(/\s+/).slice(0, 8).join(' ');
        const resumoDescricao = palavrasDescricao + '...';
        
        info += `- Prescrições: ${prescricoes.length > 0 ? `${prescricoes.length}x` : 'Nenhuma'}`;
        if (primeiroMedicamento) {
          info += ` (ex: ${primeiroMedicamento})`;
        }
        info += `\n`;
        info += `- Tema: ${resumoDescricao}\n`;
      } else {
        info += `- Status: ${ag.status}\n`;
        if (prescricoes.length > 0) {
          info += `- Prescrições: ${prescricoes.length}x\n`;
        }
      }
      
      return info;
    }).join('\n');

    const systemPrompt = [
      'Você é um agente clínico (Gemini) que auxilia médicos durante o atendimento.',
      'Responda sempre em Português do Brasil, de forma objetiva, técnica e cordial.',
      'Nunca faça diagnósticos definitivos ou prescrições sem orientação do médico.',
      'Forneça sugestões, referências e hipóteses com responsabilidade.',
      '',
      '⚠️ REGRA CRÍTICA - LEIA COM ATENÇÃO:',
      'NUNCA, em nenhuma circunstância, forneça descrições completas de atendimentos anteriores.',
      'Você tem acesso a um resumo muito curto dos atendimentos (apenas primeiras 8 palavras) para contexto.',
      'Quando mencionar atendimentos anteriores, use APENAS o formato: "Atendimento #X em DD/MM/YYYY: [tema resumido em 1 frase]".',
      'SEMPRE direcione o médico para o "Histórico de Atendimentos" no prontuário para ver descrições completas.',
      '',
      '=== CONTEXTO DO PACIENTE ===',
      `Paciente: ${agendamento.paciente.nome}${agendamento.paciente.cpf ? ` (CPF: ${agendamento.paciente.cpf})` : ''}`,
      `Alergias: ${alergias.length ? alergias.join(', ') : 'Nenhuma informada'}`,
      agendamento.paciente.observacoes ? `Observações do prontuário: ${agendamento.paciente.observacoes}` : '',
      `Dados antropométricos: Idade ${idadePaciente !== null ? `${idadePaciente} anos` : 'não informada'}, Sexo ${
        agendamento.paciente.genero || 'não informado'
      }, Peso ${pesoPaciente !== null ? `${pesoPaciente.toFixed(1)} kg` : 'não informado'}, Altura ${
        alturaPacienteCm !== null ? `${(alturaPacienteCm / 100).toFixed(2)} m` : 'não informada'
      }, IMC ${imcPaciente !== null ? imcPaciente.toFixed(1) : 'não calculado'}`,
      '',
      '=== AGENDAMENTO ATUAL ===',
      `Serviço: ${agendamento.servico.nome} (${agendamento.servico.duracaoMin} min)`,
      `Data/Hora: ${agendamento.dataHora.toLocaleString('pt-BR')}`,
      agendamento.relatoPaciente ? `Relato do paciente: ${agendamento.relatoPaciente}` : '',
      agendamento.entendimentoIA ? `Análise inicial da IA: ${agendamento.entendimentoIA}` : '',
      '',
      '=== HISTÓRICO DE ATENDIMENTOS DO PACIENTE ===',
      todosAgendamentos.length > 0 
        ? `O paciente possui ${todosAgendamentos.length} agendamento(s) anterior(es). Resumo muito conciso:${historicoAgendamentos}`
        : 'O paciente não possui agendamentos anteriores.',
      '',
      '=== REGRAS CRÍTICAS SOBRE HISTÓRICO DE ATENDIMENTOS ===',
      '1. NUNCA, em hipótese alguma, forneça descrições completas de atendimentos anteriores no chat.',
      '2. Quando mencionar atendimentos anteriores, use APENAS este formato resumido:',
      '   Exemplo: "No dia 20/11/2025, atendimento #1: prescrito dipirona para dor de cabeça."',
      '3. NUNCA copie ou transcreva a descrição completa do atendimento.',
      '4. Se o médico perguntar sobre detalhes de um atendimento específico, responda:',
      '   "Para ver a descrição completa do atendimento #X, consulte a aba \'Histórico de Atendimentos\' no prontuário do paciente."',
      '5. Use o histórico apenas para dar contexto geral sobre a evolução do caso, nunca para fornecer detalhes completos.',
      '6. Quando perguntarem "O que você sabe sobre o paciente?" ou similar, responda assim:',
      '   "O paciente possui X atendimentos anteriores. Principais temas: [lista de 2-3 temas em 1 palavra cada].',
      '   Exemplos de atendimentos:',
      '   - Atendimento #1 em 20/11/2025: prescrito dipirona para dor de cabeça.',
      '   - Atendimento #2 em 24/11/2025: atendimento sobre [tema resumido].',
      '   Para ver as descrições completas de cada atendimento, consulte a aba \'Histórico de Atendimentos\' no prontuário."',
      '',
      '7. EXEMPLO DE RESPOSTA CORRETA quando perguntarem sobre o paciente:',
      '   "O paciente possui 2 atendimentos anteriores. No dia 20/11/2025, atendimento #1: prescrito dipirona para dor de cabeça.',
      '   No dia 24/11/2025, atendimento #2: atendimento sobre sintomas diversos.',
      '   Para ver as descrições completas, consulte o Histórico de Atendimentos no prontuário."',
      '',
      '8. EXEMPLO DE RESPOSTA INCORRETA (NUNCA FAÇA ISSO):',
      '   "No atendimento de 20/11/2025, a descrição completa foi: [copiar toda a descrição aqui]"',
      '   ❌ NUNCA copie ou transcreva descrições completas.',
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

