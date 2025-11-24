import { api } from './api';
import { IPrescricao } from '../types/models';

export interface PrescricaoFilters {
  pacienteId?: number;
  doutorId?: number;
  agendamentoId?: number | null;
  skip?: number;
  take?: number;
}

export interface PrescricaoListResponse {
  prescricoes: IPrescricao[];
  total: number;
  skip: number;
  take: number;
}

export const getPrescricoes = async (filters?: PrescricaoFilters): Promise<PrescricaoListResponse> => {
  const params = filters || {};
  const response = await api.get<PrescricaoListResponse>('/prescricoes', { params });
  return response.data;
};

export const getPrescricaoById = async (id: number): Promise<IPrescricao> => {
  const response = await api.get<IPrescricao>(`/prescricoes/${id}`);
  return response.data;
};

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

export const updatePrescricao = async (id: number, data: {
  conteudo: string;
}): Promise<IPrescricao> => {
  const response = await api.put(`/prescricoes/${id}`, data);
  return response.data;
};

export const deletePrescricao = async (id: number): Promise<void> => {
  await api.delete(`/prescricoes/${id}`);
};

export const getPrescricaoByProtocolo = async (protocolo: string): Promise<IPrescricao> => {
  const response = await api.get(`/prescricoes/protocolo/${protocolo}`);
  return response.data;
};

