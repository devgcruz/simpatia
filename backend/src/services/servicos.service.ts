import { prisma } from '../lib/prisma';

interface ICreateServico {
  nome: string;
  descricao: string;
  duracaoMin: number;
  preco: number;
  doutorId: number;
}

interface IUpdateServico {
  nome?: string;
  descricao?: string;
  duracaoMin?: number;
  preco?: number;
  doutorId?: number;
}

interface AuthUser {
  id: number;
  role: string;
  clinicaId: number | null;
  doutorId?: number; // ID do doutor se o usuário for médico
}


class ServicoService {
  async getAll(clinicaId: number, doutorId?: number, user?: AuthUser) {
    const where: any = { clinicaId, ativo: true };
    
    // STRICT DOCTOR ISOLATION: Se o usuário for médico, FORÇA o filtro pelo ID dele
    // Isso garante que mesmo CLINICA_ADMIN que também é DOUTOR só vê seus próprios serviços
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        // FORÇAR filtro pelo ID do médico
        const doctorId = user.doutorId || user.id;
        where.doutorId = doctorId;
      } else if (doutorId !== undefined) {
        // Para não-médicos, permitir filtrar por doutorId se fornecido
        where.doutorId = doutorId;
      }
    } else if (doutorId !== undefined) {
      // Se não houver user, usar doutorId fornecido (compatibilidade)
      where.doutorId = doutorId;
    }
    const servicos = await prisma.servico.findMany({
      where,
      include: {
        doutor: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });
    return servicos;
  }

  async getByDoutor(doutorId: number, clinicaId: number, user?: AuthUser) {
    // STRICT DOCTOR ISOLATION: Se o usuário for médico, FORÇA o filtro pelo ID dele
    let targetDoutorId = doutorId;
    
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        // Médico só pode ver seus próprios serviços
        targetDoutorId = user.doutorId || user.id;
      }
    }
    
    const servicos = await prisma.servico.findMany({
      where: {
        doutorId: targetDoutorId,
        clinicaId,
        ativo: true,
      },
      include: {
        doutor: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });
    return servicos;
  }

  async getById(id: number, clinicaId: number, user?: AuthUser) {
    const servico = await prisma.servico.findFirst({
      where: { id, clinicaId, ativo: true },
      include: {
        doutor: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!servico) {
      throw new Error("Serviço não encontrado.");
    }

    // STRICT DOCTOR ISOLATION: Verificar acesso
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        // Médico só pode ver seus próprios serviços
        const doctorId = user.doutorId || user.id;
        if (servico.doutorId !== doctorId) {
          throw new Error('Acesso negado. Você só pode visualizar seus próprios serviços.');
        }
      }
    }

    return servico;

  }

  async create(data: ICreateServico, clinicaId: number, user?: AuthUser) {
    const { nome, descricao, duracaoMin, preco, doutorId } = data;

    if (!nome || !duracaoMin || !preco) {
      throw new Error("Nome, duração mínima e preço são obrigatórios.");
    }

    // STRICT DOCTOR ISOLATION: Se o usuário for médico, FORÇA o doutorId dele
    let targetDoutorId = doutorId;
    
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        // Médico só pode criar serviços para si mesmo
        targetDoutorId = user.doutorId || user.id;
      } else if (!doutorId) {
        throw new Error("doutorId é obrigatório.");
      }
    } else if (!doutorId) {
      throw new Error("doutorId é obrigatório.");
    }

    // Verificar se o doutor pertence à clínica
    const doutor = await prisma.doutor.findFirst({
      where: {
        id: targetDoutorId,
        clinicaId,
        ativo: true,
      },
    });

    if (!doutor) {
      throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
    }

    const novoServico = await prisma.servico.create({
      data: {
        nome,
        descricao,
        duracaoMin,
        preco,
        clinicaId,
        doutorId: targetDoutorId,
      },
    });

    return novoServico;
  }

  async update(id: number, data: IUpdateServico, clinicaId: number, user?: AuthUser) {
    const servicoExistente = await prisma.servico.findFirst({
      where: { id, clinicaId, ativo: true },
    });

    if (!servicoExistente) {
      throw new Error("Serviço não encontrado ou não pertence à esta clínica.");
    }

    // STRICT DOCTOR ISOLATION: Verificar acesso antes de atualizar
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        // Médico só pode atualizar seus próprios serviços
        const doctorId = user.doutorId || user.id;
        if (servicoExistente.doutorId !== doctorId) {
          throw new Error('Acesso negado. Você só pode atualizar seus próprios serviços.');
        }
        
        // Garantir que o doutorId não seja alterado
        if (data.doutorId && data.doutorId !== doctorId) {
          throw new Error('Acesso negado. Você não pode alterar o doutor do serviço.');
        }
      }
    }

    // Remover doutorId do update se estiver presente (não deve ser alterado)
    const updateData = { ...data };
    delete updateData.doutorId;

    const servicoAtualizado = await prisma.servico.update({
      where: { id },
      data: updateData,
    });

    return servicoAtualizado;

  }

  async delete(id: number, clinicaId: number, user?: AuthUser) {
    const servicoExistente = await prisma.servico.findFirst({
      where: { id, clinicaId, ativo: true },
    });

    if (!servicoExistente) {
      throw new Error("Serviço não encontrado ou não pertence à esta clínica.");
    }

    // STRICT DOCTOR ISOLATION: Verificar acesso antes de deletar
    if (user) {
      const isDoctor = user.role === 'DOUTOR' || user.doutorId !== undefined;
      
      if (isDoctor) {
        // Médico só pode deletar seus próprios serviços
        const doctorId = user.doutorId || user.id;
        if (servicoExistente.doutorId !== doctorId) {
          throw new Error('Acesso negado. Você só pode deletar seus próprios serviços.');
        }
      }
    }

    await prisma.servico.update({
      where: { id },
      data: { ativo: false },
    });

    return { message: "Serviço inativado com sucesso." };

  }

}

export default new ServicoService();