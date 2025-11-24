import { prisma } from '../lib/prisma';

interface ICreatePrescricao {
  conteudo: string;
  pacienteId: number;
  doutorId: number;
  agendamentoId?: number;
}

interface IUpdatePrescricao {
  conteudo?: string;
}

interface IFilterPrescricao {
  pacienteId?: number;
  doutorId?: number;
  agendamentoId?: number;
  skip?: number;
  take?: number;
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

  async getAll(filters: IFilterPrescricao = {}) {
    const where: any = {};

    if (filters.pacienteId) {
      where.pacienteId = filters.pacienteId;
    }
    if (filters.doutorId) {
      where.doutorId = filters.doutorId;
    }
    if (filters.agendamentoId !== undefined) {
      if (filters.agendamentoId === null) {
        where.agendamentoId = null;
      } else {
        where.agendamentoId = filters.agendamentoId;
      }
    }

    const [prescricoes, total] = await prisma.$transaction([
      prisma.prescricao.findMany({
        where,
        include: {
          paciente: {
            select: {
              id: true,
              nome: true,
              cpf: true,
            },
          },
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
        orderBy: {
          createdAt: 'desc',
        },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.prescricao.count({ where }),
    ]);

    return { prescricoes, total, skip: filters.skip || 0, take: filters.take || 10 };
  }

  async getById(id: number) {
    const prescricao = await prisma.prescricao.findUnique({
      where: { id },
      include: {
        paciente: {
          select: {
            id: true,
            nome: true,
            cpf: true,
          },
        },
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
          },
        },
      },
    });

    if (!prescricao) {
      throw new Error('Prescrição não encontrada');
    }

    return prescricao;
  }

  async update(id: number, data: IUpdatePrescricao) {
    const prescricao = await prisma.prescricao.findUnique({
      where: { id },
    });

    if (!prescricao) {
      throw new Error('Prescrição não encontrada');
    }

    return await prisma.prescricao.update({
      where: { id },
      data,
      include: {
        paciente: {
          select: {
            id: true,
            nome: true,
            cpf: true,
          },
        },
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

  async delete(id: number) {
    const prescricao = await prisma.prescricao.findUnique({
      where: { id },
    });

    if (!prescricao) {
      throw new Error('Prescrição não encontrada');
    }

    await prisma.prescricao.delete({
      where: { id },
    });

    return { message: 'Prescrição deletada com sucesso' };
  }
}

export default new PrescricaoService();


