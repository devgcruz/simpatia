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

interface AuthUser {
  id: number;
  role: string;
  clinicaId: number | null;
  doutorId?: number; // ID do doutor se o usuário for médico
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

    const atestados = await prisma.atestado.findMany({
      where,
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

  async findByProtocolo(protocolo: string, user?: AuthUser) {
    // IMPORTANTE: Usando 'include' apenas em relacionamentos garante que TODOS os campos
    // do modelo Atestado são retornados, incluindo horaInicial e horaFinal.
    // Esses campos são essenciais para preservar a integridade do período de afastamento.
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

    if (!atestado) {
      return null;
    }

    // STRICT DOCTOR ISOLATION: Verificar acesso
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        const doctorId = user.doutorId || user.id;
        if (atestado.doutorId !== doctorId) {
          throw new Error('Acesso negado. Você só pode visualizar seus próprios atestados.');
        }
      } else if (user.clinicaId) {
        // Não-médicos devem verificar se o atestado pertence à clínica
        if (atestado.doutor.clinicaId !== user.clinicaId) {
          throw new Error('Acesso negado. Atestado não pertence à sua clínica.');
        }
      }
    }

    // Garantir que horaInicial e horaFinal estão presentes (mesmo que null)
    // Esses campos são críticos para a integridade do documento médico
    return atestado;
  }

  async getAll(filters: IFilterAtestado = {}, user?: AuthUser) {
    const where: any = {};

    // STRICT DOCTOR ISOLATION: Se o usuário for médico, FORÇA o filtro pelo ID dele
    // Isso garante que mesmo CLINICA_ADMIN que também é DOUTOR só vê seus próprios atestados
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
        ...(filters.skip !== undefined && { skip: filters.skip }),
        ...(filters.take !== undefined && { take: filters.take }),
      }),
      prisma.atestado.count({ where }),
    ]);

    return { atestados, total, skip: filters.skip || 0, take: filters.take || 10 };
  }

  async getById(id: number, user?: AuthUser) {
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

    if (!atestado) {
      throw new Error('Atestado não encontrado');
    }

    // STRICT DOCTOR ISOLATION: Verificar acesso
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        // Médico só pode ver seus próprios atestados
        const doctorId = user.doutorId || user.id;
        if (atestado.doutorId !== doctorId) {
          throw new Error('Acesso negado. Você só pode visualizar seus próprios atestados.');
        }
      } else if (user.clinicaId) {
        // Não-médicos devem verificar se o atestado pertence à clínica
        if (atestado.doutor.clinicaId !== user.clinicaId) {
          throw new Error('Acesso negado. Atestado não pertence à sua clínica.');
        }
      }
    }

    return atestado;
  }

  async update(id: number, data: IUpdateAtestado, user?: AuthUser) {
    const atestado = await prisma.atestado.findUnique({
      where: { id },
      include: {
        doutor: {
          select: {
            id: true,
            clinicaId: true,
          },
        },
      },
    });

    if (!atestado) {
      throw new Error('Atestado não encontrado');
    }

    // STRICT DOCTOR ISOLATION: Verificar acesso antes de atualizar
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        const doctorId = user.doutorId || user.id;
        if (atestado.doutorId !== doctorId) {
          throw new Error('Acesso negado. Você só pode atualizar seus próprios atestados.');
        }
      } else if (user.clinicaId) {
        if (atestado.doutor.clinicaId !== user.clinicaId) {
          throw new Error('Acesso negado. Atestado não pertence à sua clínica.');
        }
      }
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

  async delete(id: number, user?: AuthUser) {
    const atestado = await prisma.atestado.findUnique({
      where: { id },
      include: {
        doutor: {
          select: {
            id: true,
            clinicaId: true,
          },
        },
      },
    });

    if (!atestado) {
      throw new Error('Atestado não encontrado');
    }

    // STRICT DOCTOR ISOLATION: Verificar acesso antes de deletar
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        const doctorId = user.doutorId || user.id;
        if (atestado.doutorId !== doctorId) {
          throw new Error('Acesso negado. Você só pode deletar seus próprios atestados.');
        }
      } else if (user.clinicaId) {
        if (atestado.doutor.clinicaId !== user.clinicaId) {
          throw new Error('Acesso negado. Atestado não pertence à sua clínica.');
        }
      }
    }

    await prisma.atestado.delete({
      where: { id },
    });

    return { message: 'Atestado deletado com sucesso' };
  }

  async invalidate(id: number, motivoInvalidacao: string, user?: AuthUser) {
    const atestado = await prisma.atestado.findUnique({
      where: { id },
      include: {
        doutor: {
          select: {
            id: true,
            clinicaId: true,
          },
        },
      },
    });

    if (!atestado) {
      throw new Error('Atestado não encontrado');
    }

    // STRICT DOCTOR ISOLATION: Verificar acesso antes de invalidar
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        const doctorId = user.doutorId || user.id;
        if (atestado.doutorId !== doctorId) {
          throw new Error('Acesso negado. Você só pode invalidar seus próprios atestados.');
        }
      } else if (user.clinicaId) {
        if (atestado.doutor.clinicaId !== user.clinicaId) {
          throw new Error('Acesso negado. Atestado não pertence à sua clínica.');
        }
      }
    }

    return await prisma.atestado.update({
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

export default new AtestadoService();

