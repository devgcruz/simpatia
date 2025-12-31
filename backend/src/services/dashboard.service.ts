import { prisma } from '../lib/prisma';
import moment from 'moment-timezone';

interface AuthUser {
  id: number;
  role: string;
  clinicaId: number;
}

interface DashboardMetrics {
  faturamentoMensal: number;
  atendimentosHoje: number;
  atendimentosMes: number;
  novosPacientes: number;
  taxaOcupacao: number;
  topDoutores: Array<{
    nome: string;
    especialidade: string | null;
    atendimentos: number;
  }>;
  atendimentosUltimos7Dias: Array<{
    dia: string;
    quantidade: number;
  }>;
}

class DashboardService {
  async getMetrics(user: AuthUser): Promise<DashboardMetrics> {
    // Validação de role
    if (user.role !== 'CLINICA_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new Error('Acesso negado. Apenas administradores podem acessar estas métricas.');
    }

    const clinicaId = user.clinicaId;

    // Datas para cálculos
    const hoje = moment().startOf('day');
    const inicioMes = moment().startOf('month');
    const fimMes = moment().endOf('month');
    const inicio7Dias = moment().subtract(6, 'days').startOf('day');

    // 1. Faturamento Mensal Estimado
    // Soma do preço dos serviços dos agendamentos do mês atual (não cancelados)
    // Filtrar através do relacionamento com doutor (que tem clinicaId)
    const agendamentosMes = await prisma.agendamento.findMany({
      where: {
        doutor: {
          clinicaId: clinicaId,
        },
        dataHora: {
          gte: inicioMes.toDate(),
          lte: fimMes.toDate(),
        },
        status: {
          not: 'cancelado',
        },
        ativo: true,
      },
      include: {
        servico: {
          select: {
            preco: true,
          },
        },
      },
    });

    const faturamentoMensal = agendamentosMes.reduce((total, agendamento) => {
      return total + (agendamento.servico?.preco || 0);
    }, 0);

    // 2. Atendimentos Hoje
    const atendimentosHoje = await prisma.agendamento.count({
      where: {
        doutor: {
          clinicaId: clinicaId,
        },
        dataHora: {
          gte: hoje.toDate(),
          lt: hoje.clone().endOf('day').toDate(),
        },
        status: {
          not: 'cancelado',
        },
        ativo: true,
      },
    });

    // 3. Atendimentos do Mês
    const atendimentosMes = await prisma.agendamento.count({
      where: {
        doutor: {
          clinicaId: clinicaId,
        },
        dataHora: {
          gte: inicioMes.toDate(),
          lte: fimMes.toDate(),
        },
        status: {
          not: 'cancelado',
        },
        ativo: true,
      },
    });

    // 4. Novos Pacientes do Mês
    // Como o modelo Paciente não tem createdAt, vamos contar todos os pacientes ativos
    // Nota: Para uma contagem real de "novos pacientes", seria necessário adicionar createdAt ao schema
    const novosPacientes = await prisma.paciente.count({
      where: {
        clinicaId: clinicaId,
        ativo: true,
      },
    });

    // 5. Taxa de Ocupação
    // Buscar todos os agendamentos do mês e calcular slots disponíveis
    // Para simplificar, vamos calcular baseado em uma estimativa de slots por dia
    // Assumindo que cada doutor trabalha em média 8 horas por dia (480 minutos)
    // e cada atendimento tem duração média de 30 minutos = 16 slots por dia
    const doutoresAtivos = await prisma.doutor.count({
      where: {
        clinicaId: clinicaId,
        ativo: true,
      },
    });

    const diasUteisMes = moment().daysInMonth(); // Aproximação
    const slotsDisponiveisEstimados = doutoresAtivos * diasUteisMes * 16; // 16 slots por dia
    const taxaOcupacao = slotsDisponiveisEstimados > 0
      ? (atendimentosMes / slotsDisponiveisEstimados) * 100
      : 0;

    // 6. Top 5 Doutores Mais Ativos
    // Primeiro buscar todos os agendamentos do mês da clínica
    const agendamentosMesParaTop = await prisma.agendamento.findMany({
      where: {
        doutor: {
          clinicaId: clinicaId,
        },
        dataHora: {
          gte: inicioMes.toDate(),
          lte: fimMes.toDate(),
        },
        status: {
          not: 'cancelado',
        },
        ativo: true,
      },
      select: {
        doutorId: true,
      },
    });

    // Agrupar manualmente por doutorId
    const contagemPorDoutor: Record<number, number> = {};
    agendamentosMesParaTop.forEach((ag) => {
      contagemPorDoutor[ag.doutorId] = (contagemPorDoutor[ag.doutorId] || 0) + 1;
    });

    // Ordenar e pegar top 5
    const topDoutoresIds = Object.entries(contagemPorDoutor)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([doutorId]) => Number(doutorId));

    // Buscar informações dos doutores
    const topDoutores = await Promise.all(
      topDoutoresIds.map(async (doutorId) => {
        const doutor = await prisma.doutor.findUnique({
          where: { id: doutorId },
          select: {
            nome: true,
            especialidade: true,
          },
        });

        return {
          nome: doutor?.nome || 'Doutor não encontrado',
          especialidade: doutor?.especialidade || null,
          atendimentos: contagemPorDoutor[doutorId] || 0,
        };
      })
    );

    // 7. Atendimentos dos Últimos 7 Dias
    const atendimentosUltimos7Dias = [];
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 6; i >= 0; i--) {
      const data = moment().subtract(i, 'days');
      const inicioDia = data.clone().startOf('day');
      const fimDia = data.clone().endOf('day');

      const quantidade = await prisma.agendamento.count({
        where: {
          doutor: {
            clinicaId: clinicaId,
          },
          dataHora: {
            gte: inicioDia.toDate(),
            lte: fimDia.toDate(),
          },
          status: {
            not: 'cancelado',
          },
          ativo: true,
        },
      });

      atendimentosUltimos7Dias.push({
        dia: diasSemana[data.day()],
        quantidade,
      });
    }

    return {
      faturamentoMensal,
      atendimentosHoje,
      atendimentosMes,
      novosPacientes,
      taxaOcupacao: Math.min(100, Math.max(0, taxaOcupacao)), // Limitar entre 0 e 100
      topDoutores,
      atendimentosUltimos7Dias,
    };
  }
}

export default new DashboardService();

