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

interface AuthUser {
  id: number;
  role: string;
  clinicaId: number | null;
  doutorId?: number; // ID do doutor se o usuário for médico
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

  async findByPaciente(pacienteId: number, user?: AuthUser) {
    const where: any = { pacienteId };

    // STRICT DOCTOR ISOLATION: Se o usuário for médico, FORÇA o filtro pelo ID dele
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        where.doutorId = user.doutorId || user.id;
      } else if (user.clinicaId) {
        where.doutor = { clinicaId: user.clinicaId };
      }
    }

    const prescricoes = await prisma.prescricao.findMany({
      where,
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

  async getAll(filters: IFilterPrescricao = {}, user?: AuthUser) {
    const where: any = {};

    // STRICT DOCTOR ISOLATION: Se o usuário for médico, FORÇA o filtro pelo ID dele
    // Isso garante que mesmo CLINICA_ADMIN que também é DOUTOR só vê seus próprios registros
    if (user) {
      // Verificar se é médico (role DOUTOR ou tem doutorId)
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        // FORÇAR filtro pelo ID do médico (user.id é o doutorId para médicos)
        where.doutorId = user.doutorId || user.id;
      } else if (user.clinicaId) {
        // Para não-médicos, filtrar por clínica através do relacionamento
        where.doutor = { clinicaId: user.clinicaId };
      }
    }

    if (filters.pacienteId) {
      where.pacienteId = filters.pacienteId;
    }
    // Só aplicar filtro de doutorId se não for médico (médicos já estão filtrados acima)
    if (filters.doutorId && (!user || (user.role !== 'DOUTOR' && !user.doutorId))) {
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
        ...(filters.skip !== undefined && { skip: filters.skip }),
        ...(filters.take !== undefined && { take: filters.take }),
      }),
      prisma.prescricao.count({ where }),
    ]);

    return { prescricoes, total, skip: filters.skip || 0, take: filters.take || 10 };
  }

  async getById(id: number, user?: AuthUser) {
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
            clinicaId: true,
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

    // STRICT DOCTOR ISOLATION: Verificar acesso
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        // Médico só pode ver suas próprias prescrições
        const doctorId = user.doutorId || user.id;
        if (prescricao.doutorId !== doctorId) {
          throw new Error('Acesso negado. Você só pode visualizar suas próprias prescrições.');
        }
      } else if (user.clinicaId) {
        // Não-médicos devem verificar se a prescrição pertence à clínica
        if (prescricao.doutor.clinicaId !== user.clinicaId) {
          throw new Error('Acesso negado. Prescrição não pertence à sua clínica.');
        }
      }
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

  async invalidate(id: number, motivoInvalidacao: string) {
    const prescricao = await prisma.prescricao.findUnique({
      where: { id },
    });

    if (!prescricao) {
      throw new Error('Prescrição não encontrada');
    }

    return await prisma.prescricao.update({
      where: { id },
      data: {
        invalidado: true,
        motivoInvalidacao,
      },
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
  }
}

export default new PrescricaoService();


