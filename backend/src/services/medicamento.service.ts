import { prisma } from '../lib/prisma';

interface ICreateMedicamento {
  tipoProduto?: string;
  nomeProduto: string;
  dataFinalizacaoProcesso?: Date;
  categoriaRegulatoria?: string;
  numeroRegistroProduto?: string;
  dataVencimentoRegistro?: Date;
  numeroProcesso?: string;
  classeTerapeutica?: string;
  empresaDetentoraRegistro?: string;
  situacaoRegistro?: string;
  principioAtivo?: string;
}

interface IUpdateMedicamento {
  tipoProduto?: string;
  nomeProduto?: string;
  dataFinalizacaoProcesso?: Date;
  categoriaRegulatoria?: string;
  numeroRegistroProduto?: string;
  dataVencimentoRegistro?: Date;
  numeroProcesso?: string;
  classeTerapeutica?: string;
  empresaDetentoraRegistro?: string;
  situacaoRegistro?: string;
  principioAtivo?: string;
}

interface IFilterMedicamento {
  nomeProduto?: string;
  numeroRegistroProduto?: string;
  classeTerapeutica?: string;
  categoriaRegulatoria?: string;
  situacaoRegistro?: string;
  principioAtivo?: string;
  empresaDetentoraRegistro?: string;
}

class MedicamentoService {
  async getAll(filters?: IFilterMedicamento, skip?: number, take?: number) {
    const where: any = {
      ativo: true, // Filtrar apenas medicamentos ativos
    };

    if (filters?.nomeProduto) {
      where.nomeProduto = {
        contains: filters.nomeProduto,
        mode: 'insensitive',
      };
    }

    if (filters?.numeroRegistroProduto) {
      where.numeroRegistroProduto = {
        contains: filters.numeroRegistroProduto,
        mode: 'insensitive',
      };
    }

    if (filters?.classeTerapeutica) {
      where.classeTerapeutica = {
        contains: filters.classeTerapeutica,
        mode: 'insensitive',
      };
    }

    if (filters?.categoriaRegulatoria) {
      where.categoriaRegulatoria = {
        contains: filters.categoriaRegulatoria,
        mode: 'insensitive',
      };
    }

    if (filters?.situacaoRegistro) {
      where.situacaoRegistro = {
        contains: filters.situacaoRegistro,
        mode: 'insensitive',
      };
    }

    if (filters?.principioAtivo) {
      where.principioAtivo = {
        contains: filters.principioAtivo,
        mode: 'insensitive',
      };
    }

    if (filters?.empresaDetentoraRegistro) {
      where.empresaDetentoraRegistro = {
        contains: filters.empresaDetentoraRegistro,
        mode: 'insensitive',
      };
    }

    const [medicamentos, total] = await Promise.all([
      prisma.medicamento.findMany({
        where,
        skip,
        take,
        orderBy: {
          nomeProduto: 'asc',
        },
      }),
      prisma.medicamento.count({ where }),
    ]);

    return {
      medicamentos,
      total,
      skip: skip || 0,
      take: take || medicamentos.length,
    };
  }

  async getById(id: number) {
    const medicamento = await prisma.medicamento.findFirst({
      where: { 
        id,
        ativo: true, // Apenas medicamentos ativos
      },
    });

    if (!medicamento) {
      throw new Error('Medicamento não encontrado.');
    }

    return medicamento;
  }

  async create(data: ICreateMedicamento) {
    if (!data.nomeProduto) {
      throw new Error('Nome do produto é obrigatório.');
    }

    const medicamento = await prisma.medicamento.create({
      data: {
        tipoProduto: data.tipoProduto,
        nomeProduto: data.nomeProduto,
        dataFinalizacaoProcesso: data.dataFinalizacaoProcesso,
        categoriaRegulatoria: data.categoriaRegulatoria,
        numeroRegistroProduto: data.numeroRegistroProduto,
        dataVencimentoRegistro: data.dataVencimentoRegistro,
        numeroProcesso: data.numeroProcesso,
        classeTerapeutica: data.classeTerapeutica,
        empresaDetentoraRegistro: data.empresaDetentoraRegistro,
        situacaoRegistro: data.situacaoRegistro,
        principioAtivo: data.principioAtivo,
        ativo: true, // Sempre criar como ativo
      },
    });

    return medicamento;
  }

  async update(id: number, data: IUpdateMedicamento) {
    const medicamentoExistente = await prisma.medicamento.findFirst({
      where: { 
        id,
        ativo: true, // Apenas medicamentos ativos
      },
    });

    if (!medicamentoExistente) {
      throw new Error('Medicamento não encontrado.');
    }

    const medicamentoAtualizado = await prisma.medicamento.update({
      where: { id },
      data,
    });

    return medicamentoAtualizado;
  }

  async delete(id: number) {
    const medicamentoExistente = await prisma.medicamento.findFirst({
      where: { 
        id,
        ativo: true, // Apenas medicamentos ativos
      },
    });

    if (!medicamentoExistente) {
      throw new Error('Medicamento não encontrado.');
    }

    // Soft delete: marcar como inativo ao invés de deletar fisicamente
    await prisma.medicamento.update({
      where: { id },
      data: {
        ativo: false,
      },
    });

    return { message: 'Medicamento excluído com sucesso.' };
  }

  async bulkCreate(data: ICreateMedicamento[]) {
    const medicamentos = await prisma.medicamento.createMany({
      data,
      skipDuplicates: true,
    });

    return medicamentos;
  }
}

export default new MedicamentoService();

