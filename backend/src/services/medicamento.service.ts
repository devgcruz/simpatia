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

interface AuthUser {
  id: number;
  role: string;
  clinicaId: number | null;
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

  async create(data: ICreateMedicamento, user?: AuthUser) {
    // RESTRIÇÃO: Apenas SUPER_ADMIN pode criar medicamentos
    if (!user || user.role !== 'SUPER_ADMIN') {
      throw new Error('Acesso negado. Apenas SUPER_ADMIN pode criar medicamentos.');
    }

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

  async update(id: number, data: IUpdateMedicamento, user?: AuthUser) {
    // RESTRIÇÃO: Apenas SUPER_ADMIN pode atualizar medicamentos
    if (!user || user.role !== 'SUPER_ADMIN') {
      throw new Error('Acesso negado. Apenas SUPER_ADMIN pode atualizar medicamentos.');
    }

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

  async delete(id: number, user?: AuthUser) {
    // RESTRIÇÃO: Apenas SUPER_ADMIN pode deletar medicamentos
    if (!user || user.role !== 'SUPER_ADMIN') {
      throw new Error('Acesso negado. Apenas SUPER_ADMIN pode deletar medicamentos.');
    }

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

  async bulkCreate(data: ICreateMedicamento[], user?: AuthUser) {
    // RESTRIÇÃO: Apenas SUPER_ADMIN pode criar medicamentos em lote
    if (!user || user.role !== 'SUPER_ADMIN') {
      throw new Error('Acesso negado. Apenas SUPER_ADMIN pode criar medicamentos em lote.');
    }

    const medicamentos = await prisma.medicamento.createMany({
      data,
      skipDuplicates: true,
    });

    return medicamentos;
  }

  async getPrincipiosAtivos(busca?: string) {
    const where: any = {
      ativo: true,
      principioAtivo: {
        not: null,
      },
    };

    if (busca && busca.trim()) {
      where.principioAtivo = {
        contains: busca.trim(),
        mode: 'insensitive',
      };
    }

    const medicamentos = await prisma.medicamento.findMany({
      where,
      select: {
        principioAtivo: true,
      },
      orderBy: {
        principioAtivo: 'asc',
      },
      take: 200, // Buscar mais para depois filtrar
    });

    // Extrair e filtrar princípios ativos únicos
    const principiosAtivos = medicamentos
      .map((m) => m.principioAtivo)
      .filter((pa): pa is string => pa !== null && pa.trim() !== '')
      .filter((pa, index, self) => {
        // Remover duplicatas (case-insensitive)
        const paLower = pa.toLowerCase();
        return self.findIndex((p) => p.toLowerCase() === paLower) === index;
      })
      .slice(0, 50) // Limitar a 50 resultados finais
      .sort();

    return principiosAtivos;
  }

  async verificarPrincipioAtivoExiste(principioAtivo: string): Promise<boolean> {
    const medicamento = await prisma.medicamento.findFirst({
      where: {
        ativo: true,
        principioAtivo: {
          equals: principioAtivo.trim(),
          mode: 'insensitive',
        },
      },
    });

    return !!medicamento;
  }
}

export default new MedicamentoService();

