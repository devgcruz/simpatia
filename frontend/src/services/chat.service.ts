import { api } from './api';
import { IPaciente } from '../types/models';

export type ChatSenderType = 'IA' | 'PACIENTE' | 'DOUTOR';

export interface IChatMessage {
  id: number;
  content: string;
  senderType: ChatSenderType;
  createdAt: string;
  pacienteId: number;
}

export type ChatStatus = 'BOT' | 'HANDOFF' | 'CLOSED';

export type HandoffPaciente = Pick<IPaciente, 'id' | 'nome' | 'telefone'> & {
  chatStatus: ChatStatus;
};

/**
 * GET /api/chat/handoff
 *
 * Busca a lista de pacientes com status 'HANDOFF' (aguardando atendimento humano).
 */
export const getHandoffQueue = async (): Promise<HandoffPaciente[]> => {
  const response = await api.get('/chat/handoff');
  return response.data;
};

/**
 * GET /api/chat/paciente/:pacienteId
 *
 * Busca o histórico de chat completo de um paciente específico.
 */
export const getChatHistory = async (
  pacienteId: number,
): Promise<IChatMessage[]> => {
  const response = await api.get(`/chat/paciente/${pacienteId}`);
  return response.data;
};

/**
 * POST /api/chat/paciente/:pacienteId/send
 *
 * Envia uma nova mensagem como Doutor/Admin para o paciente.
 */
export const sendDoutorMessage = async (
  pacienteId: number,
  content: string,
): Promise<IChatMessage> => {
  const response = await api.post(`/chat/paciente/${pacienteId}/send`, {
    content,
  });
  return response.data;
};

/**
 * POST /api/chat/paciente/:pacienteId/close
 *
 * Fecha o atendimento humano e devolve o paciente para o BOT.
 */
export const closeHandoffChat = async (
  pacienteId: number,
): Promise<HandoffPaciente> => {
  const response = await api.post(`/chat/paciente/${pacienteId}/close`);
  return response.data;
};


