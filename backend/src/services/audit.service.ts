import { prisma } from '../lib/prisma';

interface CreateAuditLogDTO {
  usuarioId?: number;
  acao: string;
  detalhes?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Cria um log de auditoria
 */
export async function createAuditLog(data: CreateAuditLogDTO) {
  try {
    await prisma.chatAuditLog.create({
      data: {
        usuarioId: data.usuarioId,
        acao: data.acao,
        detalhes: data.detalhes,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    // Não falhar a operação principal se o log falhar
    console.error('Erro ao criar log de auditoria:', error);
  }
}

/**
 * Busca logs de auditoria
 */
export async function getAuditLogs(filters: {
  usuarioId?: number;
  acao?: string;
  inicio?: Date;
  fim?: Date;
  page?: number;
  limit?: number;
}) {
  const { usuarioId, acao, inicio, fim, page = 1, limit = 50 } = filters;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (usuarioId) {
    where.usuarioId = usuarioId;
  }

  if (acao) {
    where.acao = acao;
  }

  if (inicio || fim) {
    where.createdAt = {};
    if (inicio) {
      where.createdAt.gte = inicio;
    }
    if (fim) {
      where.createdAt.lte = fim;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.chatAuditLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip,
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.chatAuditLog.count({ where }),
  ]);

  return {
    logs,
    paginacao: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

