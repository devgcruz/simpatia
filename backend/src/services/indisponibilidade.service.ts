import { prisma } from '../lib/prisma';

interface CreateIndisponibilidadeInput {
  doutorId: number;
  inicio: Date | string;
  fim: Date | string;
  motivo?: string;
}

class IndisponibilidadeService {
  async listByClinica(clinicaId: number) {
    return prisma.indisponibilidade.findMany({
      where: { doutor: { clinicaId } },
      include: { doutor: { select: { id: true, nome: true, clinicaId: true } } },
      orderBy: { inicio: 'asc' },
    });
  }

  async listByDoutor(doutorId: number) {
    return prisma.indisponibilidade.findMany({
      where: { doutorId },
      orderBy: { inicio: 'asc' },
    });
  }

  async create(data: CreateIndisponibilidadeInput, user: { clinicaId: number }) {
    const { doutorId, inicio, fim, motivo } = data;

    // Verificar se doutor pertence à clínica do usuário
    const doutor = await prisma.doutor.findFirst({
      where: { id: doutorId, clinicaId: user.clinicaId, ativo: true },
      select: { id: true },
    });
    if (!doutor) {
      throw new Error('Doutor não encontrado ou não pertence a esta clínica.');
    }

    const inicioDate = typeof inicio === 'string' ? new Date(inicio) : inicio;
    const fimDate = typeof fim === 'string' ? new Date(fim) : fim;
    if (isNaN(inicioDate.getTime()) || isNaN(fimDate.getTime()) || inicioDate >= fimDate) {
      throw new Error('Período inválido.');
    }

    return prisma.indisponibilidade.create({
      data: {
        doutorId,
        inicio: inicioDate,
        fim: fimDate,
        motivo,
      },
    });
  }

  async update(id: number, data: Partial<CreateIndisponibilidadeInput>, user: { clinicaId: number }) {
    const registro = await prisma.indisponibilidade.findFirst({
      where: { id, doutor: { clinicaId: user.clinicaId } },
      select: { id: true },
    });
    if (!registro) {
      throw new Error('Indisponibilidade não encontrada.');
    }

    const updateData: any = {};
    if (data.inicio) {
      updateData.inicio = typeof data.inicio === 'string' ? new Date(data.inicio) : data.inicio;
    }
    if (data.fim) {
      updateData.fim = typeof data.fim === 'string' ? new Date(data.fim) : data.fim;
    }
    if (data.motivo !== undefined) {
      updateData.motivo = data.motivo;
    }
    if (data.doutorId) {
      // Verificar se novo doutor pertence à clínica
      const doutor = await prisma.doutor.findFirst({
        where: { id: data.doutorId, clinicaId: user.clinicaId, ativo: true },
        select: { id: true },
      });
      if (!doutor) {
        throw new Error('Doutor não encontrado ou não pertence a esta clínica.');
      }
      updateData.doutorId = data.doutorId;
    }

    // Validar período se ambos estão sendo atualizados
    if (updateData.inicio && updateData.fim) {
      const inicioDate = typeof updateData.inicio === 'string' ? new Date(updateData.inicio) : updateData.inicio;
      const fimDate = typeof updateData.fim === 'string' ? new Date(updateData.fim) : updateData.fim;
      if (isNaN(inicioDate.getTime()) || isNaN(fimDate.getTime()) || inicioDate >= fimDate) {
        throw new Error('Período inválido.');
      }
    }

    return prisma.indisponibilidade.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: number, user: { clinicaId: number }) {
    const registro = await prisma.indisponibilidade.findFirst({
      where: { id, doutor: { clinicaId: user.clinicaId } },
      select: { id: true },
    });
    if (!registro) {
      throw new Error('Indisponibilidade não encontrada.');
    }
    return prisma.indisponibilidade.update({ 
      where: { id },
      data: { ativo: false },
    });
  }
}

export default new IndisponibilidadeService();


