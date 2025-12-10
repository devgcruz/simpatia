import { api } from './api';
import { IAtestado } from '../types/atestado';

export interface AtestadoFilters {
  pacienteId?: number;
  doutorId?: number;
  agendamentoId?: number | null;
  skip?: number;
  take?: number;
}

export interface AtestadoListResponse {
  atestados: IAtestado[];
  total: number;
  skip: number;
  take: number;
}

export const getAtestados = async (filters?: AtestadoFilters): Promise<AtestadoListResponse> => {
  const params = filters || {};
  const response = await api.get<AtestadoListResponse>('/atestados', { params });
  return response.data;
};

export const getAtestadoById = async (id: number): Promise<IAtestado> => {
  const response = await api.get<IAtestado>(`/atestados/${id}`);
  return response.data;
};

export const getAtestadosPaciente = async (pacienteId: number): Promise<IAtestado[]> => {
  const response = await api.get(`/atestados/paciente/${pacienteId}`);
  return response.data;
};

export const createAtestado = async (data: {
  diasAfastamento: number;
  cid?: string;
  exibirCid: boolean;
  conteudo: string;
  localAtendimento?: string;
  dataAtestado?: string;
  pacienteId: number;
  doutorId: number;
  agendamentoId?: number;
}): Promise<IAtestado> => {
  const response = await api.post('/atestados', data);
  return response.data;
};

export const updateAtestado = async (id: number, data: {
  diasAfastamento?: number;
  cid?: string;
  exibirCid?: boolean;
  conteudo?: string;
  localAtendimento?: string;
  dataAtestado?: string;
}): Promise<IAtestado> => {
  const response = await api.put(`/atestados/${id}`, data);
  return response.data;
};

export const deleteAtestado = async (id: number): Promise<void> => {
  await api.delete(`/atestados/${id}`);
};

export const getAtestadoByProtocolo = async (protocolo: string): Promise<IAtestado> => {
  const response = await api.get(`/atestados/protocolo/${protocolo}`);
  return response.data;
};

