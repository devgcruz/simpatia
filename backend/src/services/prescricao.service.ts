import { prisma } from '../lib/prisma';

interface ICreatePrescricao {
  conteudo: string;
  pacienteId: number;
  doutorId: number;
  agendamentoId?: number;
}

class PrescricaoService {
  async create(data: ICreatePrescricao) {
    return await prisma.prescricao.create({
      data,
      include: {
        doutor: {
          select: {
            id: true,
            nome: true,
            especialidade: true,
          },
        },
        agendamento: {
          select: {
            id: true,
            dataHora: true,
            servico: {
              select: {
                nome: true,
              },
            },
          },
        },
      },
    });
  }

  async findByPaciente(pacienteId: number) {
    const prescricoes = await prisma.prescricao.findMany({
      where: { pacienteId },
      include: {
        doutor: {
          select: {
            id: true,
            nome: true,
            especialidade: true,
          },
        },
        agendamento: {
          select: {
            id: true,
            dataHora: true,
            servico: {
              select: {
                nome: true,
              },
            },
            historicos: {
              select: {
                id: true,
                protocolo: true,
              },
              orderBy: {
                realizadoEm: 'desc',
              },
              take: 1, // Pegar apenas o histórico mais recente do agendamento
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Mapear para incluir o ID e protocolo do histórico mais recente
    return prescricoes.map((prescricao) => ({
      ...prescricao,
      historicoId: prescricao.agendamento?.historicos?.[0]?.id || null,
      historicoProtocolo: prescricao.agendamento?.historicos?.[0]?.protocolo || null,
    }));
  }

  async findByProtocolo(protocolo: string) {
    const prescricao = await prisma.prescricao.findUnique({
      where: { protocolo },
      include: {
        paciente: true,
        doutor: {
          select: {
            id: true,
            nome: true,
            especialidade: true,
            crm: true,
            crmUf: true,
            rqe: true,
            modeloPrescricao: true,
            clinica: {
              select: {
                id: true,
                nome: true,
                cnpj: true,
                endereco: true,
                telefone: true,
                email: true,
                site: true,
              },
            },
          },
        },
        agendamento: {
          select: {
            id: true,
            dataHora: true,
            servico: {
              select: {
                nome: true,
              },
            },
            historicos: {
              select: {
                id: true,
                protocolo: true,
              },
              orderBy: {
                realizadoEm: 'desc',
              },
              take: 1, // Pegar apenas o histórico mais recente do agendamento
            },
          },
        },
      },
    });

    if (!prescricao) {
      return null;
    }

    // Incluir o ID e protocolo do histórico mais recente
    return {
      ...prescricao,
      historicoId: prescricao.agendamento?.historicos?.[0]?.id || null,
      historicoProtocolo: prescricao.agendamento?.historicos?.[0]?.protocolo || null,
    };
  }
}

export default new PrescricaoService();


