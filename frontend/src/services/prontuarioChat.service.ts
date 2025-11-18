import { api } from './api';
import { IProntuarioChatMessage } from '../types/models';

export const getProntuarioChatMessages = async (agendamentoId: number) => {
  const response = await api.get<IProntuarioChatMessage[]>(`/agendamentos/${agendamentoId}/prontuario-chat`);
  return response.data;
};

export const sendProntuarioChatMessage = async (agendamentoId: number, message: string) => {
  const response = await api.post<{ messages: IProntuarioChatMessage[] }>(`/agendamentos/${agendamentoId}/prontuario-chat`, {
    message,
  });
  return response.data;
};

