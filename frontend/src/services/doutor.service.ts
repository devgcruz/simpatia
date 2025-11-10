import { api } from './api';
import { IDoutor, DoutorRole } from '../types/models';

export interface DoutorCreateInput {
  nome: string;
  email: string;
  senha: string;
  especialidade?: string;
  role: DoutorRole;
  clinicaId?: number;
}

export interface DoutorUpdateInput {
  nome?: string;
  email?: string;
  senha?: string;
  especialidade?: string;
  role?: DoutorRole;
}

export const getDoutores = async () => {
  const response = await api.get<IDoutor[]>('/doutores');
  return response.data;
};

export const createDoutor = async (data: DoutorCreateInput) => {
  const response = await api.post<IDoutor>('/doutores', data);
  return response.data;
};

export const updateDoutor = async (id: number, data: DoutorUpdateInput) => {
  const response = await api.put<IDoutor>(`/doutores/${id}`, data);
  return response.data;
};

export const deleteDoutor = async (id: number) => {
  await api.delete(`/doutores/${id}`);
};

