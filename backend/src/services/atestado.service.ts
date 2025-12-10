import { prisma } from '../lib/prisma';

interface ICreateAtestado {
  diasAfastamento: number;
  horaInicial?: string;
  horaFinal?: string;
  cid?: string;
  exibirCid: boolean;
  conteudo: string;
  localAtendimento?: string;
  dataAtestado?: string;
  pacienteId: number;
  doutorId: number;
  agendamentoId?: number;
}

interface IUpdateAtestado {
  diasAfastamento?: number;
  horaInicial?: string;
  horaFinal?: string;
  cid?: string;
  exibirCid?: boolean;
  conteudo?: string;
  localAtendimento?: string;
  dataAtestado?: string;
}

interface IFilterAtestado {
  pacienteId?: number;
  doutorId?: number;
  agendamentoId?: number;
  skip?: number;
  take?: number;
}

class AtestadoService {
  async create(data: ICreateAtestado) {
    const createData: any = {
      ...data,
    };
    
    // Converter dataAtestado de string para Date se fornecido
    if (data.dataAtestado) {
      createData.dataAtestado = new Date(data.dataAtestado);
    }
    
    return await prisma.atestado.create({
      data: createData,
      include: {
        doutor: {
          select: {
            id: true,
            nome: true,
            especialidade: true,
            crm: true,
            crmUf: true,
            rqe: true,
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
  }

  async findByPaciente(pacienteId: number) {
    const atestados = await prisma.atestado.findMany({
      where: { pacienteId },
      include: {
        doutor: {
          select: {
            id: true,
            nome: true,
            especialidade: true,
            crm: true,
            crmUf: true,
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
    });

    return atestados;
  }

  async findByProtocolo(protocolo: string) {
    const atestado = await prisma.atestado.findUnique({
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

    if (!atestado) {
      return null;
    }

    return atestado;
  }

  async getAll(filters: IFilterAtestado = {}) {
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

    const [atestados, total] = await prisma.$transaction([
      prisma.atestado.findMany({
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
              crm: true,
              crmUf: true,
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
      prisma.atestado.count({ where }),
    ]);

    return { atestados, total, skip: filters.skip || 0, take: filters.take || 10 };
  }

  async getById(id: number) {
    const atestado = await prisma.atestado.findUnique({
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

    if (!atestado) {
      throw new Error('Atestado não encontrado');
    }

    return atestado;
  }

  async update(id: number, data: IUpdateAtestado) {
    const atestado = await prisma.atestado.findUnique({
      where: { id },
    });

    if (!atestado) {
      throw new Error('Atestado não encontrado');
    }

    const updateData: any = { ...data };
    
    // Converter dataAtestado de string para Date se fornecido
    if (data.dataAtestado) {
      updateData.dataAtestado = new Date(data.dataAtestado);
    }

    return await prisma.atestado.update({
      where: { id },
      data: updateData,
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
    const atestado = await prisma.atestado.findUnique({
      where: { id },
    });

    if (!atestado) {
      throw new Error('Atestado não encontrado');
    }

    await prisma.atestado.delete({
      where: { id },
    });

    return { message: 'Atestado deletado com sucesso' };
  }
}

export default new AtestadoService();

