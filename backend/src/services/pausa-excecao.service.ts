import { PrismaClient } from '@prisma/client';
import { isAdmin, isSuperAdmin } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

export interface ICreatePausaExcecao {
  data: string; // ISO date string (YYYY-MM-DD)
  pausaInicio: string; // "HH:MM"
  pausaFim: string; // "HH:MM"
  clinicaId?: number;
  doutorId?: number;
}

export interface IUpdatePausaExcecao {
  pausaInicio?: string;
  pausaFim?: string;
}

const select = {
  id: true,
  data: true,
  pausaInicio: true,
  pausaFim: true,
  clinicaId: true,
  doutorId: true,
  clinica: {
    select: {
      id: true,
      nome: true,
    },
  },
  doutor: {
    select: {
      id: true,
      nome: true,
    },
  },
  createdAt: true,
};

export const listByClinica = async (clinicaId: number, startDate?: string, endDate?: string) => {
  const where: any = {
    clinicaId,
    doutorId: null,
  };

  if (startDate || endDate) {
    where.data = {};
    if (startDate) {
      where.data.gte = new Date(startDate);
    }
    if (endDate) {
      where.data.lte = new Date(endDate);
    }
  }

  return prisma.pausaExcecao.findMany({
    where,
    select,
    orderBy: { data: 'asc' },
  });
};

export const listByDoutor = async (doutorId: number, startDate?: string, endDate?: string) => {
  const where: any = {
    doutorId,
    clinicaId: null,
  };

  if (startDate || endDate) {
    where.data = {};
    if (startDate) {
      where.data.gte = new Date(startDate);
    }
    if (endDate) {
      where.data.lte = new Date(endDate);
    }
  }

  return prisma.pausaExcecao.findMany({
    where,
    select,
    orderBy: { data: 'asc' },
  });
};

export const findByDate = async (
  data: string,
  clinicaId?: number,
  doutorId?: number
) => {
  const where: any = {
    data: new Date(data),
  };

  if (clinicaId !== undefined) {
    where.clinicaId = clinicaId;
    where.doutorId = null;
  } else if (doutorId !== undefined) {
    where.doutorId = doutorId;
    where.clinicaId = null;
  }

  return prisma.pausaExcecao.findFirst({
    where,
    select,
  });
};

export const create = async (data: ICreatePausaExcecao) => {
  // Verificar se já existe exceção para essa data
  const existing = await findByDate(data.data, data.clinicaId, data.doutorId);
  
  if (existing) {
    // Se já existe, atualizar
    return prisma.pausaExcecao.update({
      where: { id: existing.id },
      data: {
        pausaInicio: data.pausaInicio,
        pausaFim: data.pausaFim,
      },
      select,
    });
  }

  // Criar nova exceção
  return prisma.pausaExcecao.create({
    data: {
      data: new Date(data.data),
      pausaInicio: data.pausaInicio,
      pausaFim: data.pausaFim,
      clinicaId: data.clinicaId || null,
      doutorId: data.doutorId || null,
    },
    select,
  });
};

export const update = async (id: number, data: IUpdatePausaExcecao) => {
  return prisma.pausaExcecao.update({
    where: { id },
    data,
    select,
  });
};

export const remove = async (id: number) => {
  return prisma.pausaExcecao.update({
    where: { id },
    data: { ativo: false },
  });
};

