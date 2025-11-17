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


class ServicoService {
  async getAll(clinicaId: number, doutorId?: number) {
    const where: any = { clinicaId };
    if (doutorId !== undefined) {
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

  async getByDoutor(doutorId: number, clinicaId: number) {
    const servicos = await prisma.servico.findMany({
      where: {
        doutorId,
        clinicaId,
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

  async getById(id: number, clinicaId: number) {
    const servico = await prisma.servico.findFirst({
      where: { id, clinicaId },
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

    return servico;

  }

  async create(data: ICreateServico, clinicaId: number) {
    const { nome, descricao, duracaoMin, preco, doutorId } = data;

    if (!nome || !duracaoMin || !preco) {
      throw new Error("Nome, duração mínima e preço são obrigatórios.");
    }

    if (!doutorId) {
      throw new Error("doutorId é obrigatório.");
    }

    // Verificar se o doutor pertence à clínica
    const doutor = await prisma.doutor.findFirst({
      where: {
        id: doutorId,
        clinicaId,
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
        doutorId,
      },
    });

    return novoServico;
  }

  async update(id: number, data: IUpdateServico, clinicaId: number) {
    const servicoExistente = await prisma.servico.findFirst({
      where: { id, clinicaId },
    });

    if (!servicoExistente) {
      throw new Error("Serviço não encontrado ou não pertence à esta clínica.");
    }

    const servicoAtualizado = await prisma.servico.update({
      where: { id },
      data: data,
    });

    return servicoAtualizado;

  }

  async delete(id: number, clinicaId: number) {
    const servicoExistente = await prisma.servico.findFirst({
      where: { id, clinicaId },
    });

    if (!servicoExistente) {
      throw new Error("Serviço não encontrado ou não pertence à esta clínica.");
    }

    await prisma.servico.delete({
      where: { id },
    });

    return { message: "Serviço deletado com sucesso." };

  }

}

export default new ServicoService();