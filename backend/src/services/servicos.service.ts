import { prisma } from '../lib/prisma';

interface ICreateServico {
  nome: string;
  descricao: string;
  duracaoMin: number;
  preco: number;
}

interface IUpdateServico {
  nome?: string;
  descricao?: string;
  duracaoMin?: number;
  preco?: number;
}


class ServicoService {
  async getAll(clinicaId: number) {
    const servicos = await prisma.servico.findMany({
      where: { clinicaId },
    });
    return servicos;
  }

  async getById(id: number, clinicaId: number) {
    const servico = await prisma.servico.findFirst({
      where: { id, clinicaId },
    });

    if (!servico) {
      throw new Error("Serviço não encontrado.");
    }

    return servico;

  }

  async create(data: ICreateServico, clinicaId: number) {
    const { nome, descricao, duracaoMin, preco } = data;

    if (!nome || !duracaoMin || !preco) {
      throw new Error("Nome, duração mínima e preço são obrigatórios.");
    }

    const novoServico = await prisma.servico.create({
      data: {
        nome,
        descricao,
        duracaoMin,
        preco,
        clinicaId,
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