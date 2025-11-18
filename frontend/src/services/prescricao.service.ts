import { api } from './api';
import { IPrescricao } from '../types/models';

export const getPrescricoesPaciente = async (pacienteId: number): Promise<IPrescricao[]> => {
  const response = await api.get(`/prescricoes/paciente/${pacienteId}`);
  return response.data;
};

export const createPrescricao = async (data: {
  conteudo: string;
  pacienteId: number;
  doutorId: number;
  agendamentoId?: number;
}): Promise<IPrescricao> => {
  const response = await api.post('/prescricoes', data);
  return response.data;
};

export const getPrescricaoByProtocolo = async (protocolo: string): Promise<IPrescricao> => {
  const response = await api.get(`/prescricoes/protocolo/${protocolo}`);
  return response.data;
};

