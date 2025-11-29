import { prisma } from '../lib/prisma';
import moment from 'moment-timezone';
import { formatBrazilDate, parseBrazilDateTime, BRAZIL_TZ } from '../utils/timezone';

interface CreateIndisponibilidadeInput {
  doutorId: number;
  inicio: Date | string;
  fim: Date | string;
  motivo?: string;
}

const formatResponse = <T extends { inicio: Date; fim: Date }>(item: T) => ({
  ...item,
  inicioFormatado: formatBrazilDate(item.inicio),
  fimFormatado: formatBrazilDate(item.fim),
});

class IndisponibilidadeService {
  async listByClinica(clinicaId: number) {
    const registros = await prisma.indisponibilidade.findMany({
      where: { doutor: { clinicaId } },
      include: { doutor: { select: { id: true, nome: true, clinicaId: true } } },
      orderBy: { inicio: 'asc' },
    });
    return registros.map(formatResponse);
  }

  async listByDoutor(doutorId: number) {
    const registros = await prisma.indisponibilidade.findMany({
      where: { doutorId, ativo: true },
      orderBy: { inicio: 'asc' },
    });
    return registros.map(formatResponse);
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

    const inicioMoment = parseBrazilDateTime(inicio);
    const fimMoment = parseBrazilDateTime(fim);

    if (!fimMoment.isAfter(inicioMoment)) {
      throw new Error('Período inválido.');
    }

    const created = await prisma.indisponibilidade.create({
      data: {
        doutorId,
        inicio: inicioMoment.tz(BRAZIL_TZ).toDate(),
        fim: fimMoment.tz(BRAZIL_TZ).toDate(),
        motivo: motivo?.trim() || null,
      },
    });

    return formatResponse(created);
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
      updateData.inicio = parseBrazilDateTime(data.inicio).tz(BRAZIL_TZ).toDate();
    }
    if (data.fim) {
      updateData.fim = parseBrazilDateTime(data.fim).tz(BRAZIL_TZ).toDate();
    }
    if (data.motivo !== undefined) {
      updateData.motivo = data.motivo?.trim() ?? null;
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
      const inicioMoment = moment(updateData.inicio).tz(BRAZIL_TZ);
      const fimMoment = moment(updateData.fim).tz(BRAZIL_TZ);
      if (!fimMoment.isAfter(inicioMoment)) {
        throw new Error('Período inválido.');
      }
    }

    const updated = await prisma.indisponibilidade.update({
      where: { id },
      data: updateData,
    });

    return formatResponse(updated);
  }

  async delete(id: number, user: { clinicaId: number }) {
    const registro = await prisma.indisponibilidade.findFirst({
      where: { id, doutor: { clinicaId: user.clinicaId } },
      select: { id: true },
    });
    if (!registro) {
      throw new Error('Indisponibilidade não encontrada.');
    }
    const updated = await prisma.indisponibilidade.update({ 
      where: { id },
      data: { ativo: false },
    });
    return formatResponse(updated);
  }
}

export default new IndisponibilidadeService();
