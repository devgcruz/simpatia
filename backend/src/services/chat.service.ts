import { prisma } from '../lib/prisma';
import { SenderType } from '@prisma/client';
import whatsappService from './whatsapp.service';

interface AuthUser {
  id: number;
  role: string;
  clinicaId: number | null;
}

class ChatService {
  /**
   * Busca todos os pacientes que estão na fila de atendimento humano (HANDOFF).
   */
  async getHandoffPacientes(user: AuthUser) {
    if (!user.clinicaId) {
      throw new Error('Usuário não está associado a uma clínica.');
    }

    if (user.role !== 'CLINICA_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new Error('Acesso negado.');
    }

    return prisma.paciente.findMany({
      where: {
        clinicaId: user.clinicaId,
        chatStatus: 'HANDOFF',
      },
      select: {
        id: true,
        nome: true,
        telefone: true,
        chatStatus: true,
      },
      orderBy: {
        nome: 'asc',
      },
    });
  }

  /**
   * Busca o histórico de mensagens de um paciente específico.
   */
  async getChatHistory(pacienteId: number, user: AuthUser) {
    if (!user.clinicaId) {
      throw new Error('Usuário não está associado a uma clínica.');
    }

    const paciente = await prisma.paciente.findFirst({
      where: { id: pacienteId, clinicaId: user.clinicaId },
    });

    if (!paciente) {
      throw new Error('Paciente não encontrado ou não pertence a esta clínica.');
    }

    return prisma.chatMessage.findMany({
      where: { pacienteId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Permite que um Doutor/Admin envie uma mensagem para o paciente via WhatsApp.
   */
  async doutorSendMensagem(pacienteId: number, content: string, user: AuthUser) {
    if (!user.clinicaId) {
      throw new Error('Usuário não está associado a uma clínica.');
    }
    if (!content || !content.trim()) {
      throw new Error('O conteúdo da mensagem não pode estar vazio.');
    }

    const paciente = await prisma.paciente.findFirst({
      where: { id: pacienteId, clinicaId: user.clinicaId },
      include: { clinica: true },
    });

    if (!paciente) {
      throw new Error('Paciente não encontrado ou não pertence a esta clínica.');
    }

    if (!paciente.clinica?.whatsappToken || !paciente.clinica?.whatsappPhoneId) {
      throw new Error('As credenciais do WhatsApp não estão configuradas para esta clínica.');
    }

    const transacao = await prisma.$transaction(async (tx) => {
      const dbMessage = await tx.chatMessage.create({
        data: {
          content: content.trim(),
          senderType: SenderType.DOUTOR,
          pacienteId: paciente.id,
        },
      });

      await whatsappService.enviarMensagem(
        paciente.telefone,
        content.trim(),
        paciente.clinica.whatsappToken as string,
        paciente.clinica.whatsappPhoneId as string,
      );

      return dbMessage;
    });

    return transacao;
  }

  /**
   * Fecha um chat de handoff e devolve o paciente para o BOT.
   */
  async closeChat(pacienteId: number, user: AuthUser) {
    if (!user.clinicaId) {
      throw new Error('Usuário não está associado a uma clínica.');
    }

    const paciente = await prisma.paciente.findFirst({
      where: { id: pacienteId, clinicaId: user.clinicaId },
    });

    if (!paciente) {
      throw new Error('Paciente não encontrado ou não pertence a esta clínica.');
    }

    return prisma.paciente.update({
      where: { id: pacienteId },
      data: { chatStatus: 'BOT' },
    });
  }
}

export default new ChatService();

