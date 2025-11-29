import { api } from './api';

export interface ISecretaria {
  id: number;
  nome: string;
  email: string;
  clinicaId: number;
  clinica?: {
    id: number;
    nome: string;
  };
  doutoresVinculados: Array<{
    id: number;
    nome: string;
    email: string;
    especialidade?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SecretariaCreateInput {
  nome: string;
  email: string;
  senha: string;
  doutorIds: number[];
}

export interface SecretariaUpdateInput {
  nome?: string;
  email?: string;
  senha?: string;
  doutorIds?: number[];
}

export const getSecretarias = async (): Promise<ISecretaria[]> => {
  const response = await api.get<ISecretaria[]>('/secretarias');
  return response.data;
};

export const getSecretariaById = async (id: number): Promise<ISecretaria> => {
  const response = await api.get<ISecretaria>(`/secretarias/${id}`);
  return response.data;
};

export const createSecretaria = async (data: SecretariaCreateInput): Promise<ISecretaria> => {
  const response = await api.post<ISecretaria>('/secretarias', data);
  return response.data;
};

export const updateSecretaria = async (id: number, data: SecretariaUpdateInput): Promise<ISecretaria> => {
  const response = await api.put<ISecretaria>(`/secretarias/${id}`, data);
  return response.data;
};

export const deleteSecretaria = async (id: number): Promise<void> => {
  await api.delete(`/secretarias/${id}`);
};


