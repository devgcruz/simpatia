import { prisma } from '../lib/prisma';

interface ICreatePrescricao {
  conteudo: string;
  pacienteId: number;
  doutorId: number;
  agendamentoId?: number;
}

class PrescricaoService {
  async create(data: ICreatePrescricao) {
    return await prisma.prescricao.create({
      data,
      include: {
        doutor: {
          select: {
            id: true,
            nome: true,
            especialidade: true,
          },
        },
        agendamento: {
          select: {
            id: true,
            dataHora: true,
            servico: {
              select: {
                nome: true,
              },
            },
          },
        },
      },
    });
  }

  async findByPaciente(pacienteId: number) {
    return await prisma.prescricao.findMany({
      where: { pacienteId },
      include: {
        doutor: {
          select: {
            id: true,
            nome: true,
            especialidade: true,
          },
        },
        agendamento: {
          select: {
            id: true,
            dataHora: true,
            servico: {
              select: {
                nome: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByProtocolo(protocolo: string) {
    return await prisma.prescricao.findUnique({
      where: { protocolo },
      include: {
        paciente: true,
        doutor: {
          select: {
            id: true,
            nome: true,
            especialidade: true,
          },
        },
        agendamento: {
          select: {
            id: true,
            dataHora: true,
            servico: {
              select: {
                nome: true,
              },
            },
          },
        },
      },
    });
  }
}

export default new PrescricaoService();


