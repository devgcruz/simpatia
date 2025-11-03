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

  async getAll() {
    const servicos = await prisma.servico.findMany();
    return servicos;
  }

  async getById(id: number) {
    const servico = await prisma.servico.findUnique({
      where: { id },
    });

    if (!servico) {
      throw new Error("Serviço não encontrado.");
    }

    return servico;

  }

  async create(data: ICreateServico) {
    const { nome, descricao, duracaoMin, preco } = data;

    if (!nome || !duracaoMin || !preco) {
      throw new Error("Nome, duração mínima e preço são obrigatórios.");
    }

    const novoServico = await prisma.servico.create({
      data: {
        nome,
        descricao,
        duracaoMin,
        preco
      }
    });

    return novoServico;
  }

  async update(id: number, data: IUpdateServico) {
    const servicoExistente = await prisma.servico.findUnique({
      where: { id },
    });

    if (!servicoExistente) {
      throw new Error("Serviço não encontrado.");
    }

    const servicoAtualizado = await prisma.servico.update({
      where: { id },
      data: data,
    });

    return servicoAtualizado;

  }

  async delete(id: number) {

    const servicoExistente = await prisma.servico.findUnique({
      where: { id },
    });

    if (!servicoExistente) {
      throw new Error("Serviço não encontrado.");
    }

    await prisma.servico.delete({
      where: { id },
    });

    return { message: "Serviço deletado com sucesso." };

  }

}

export default new ServicoService();