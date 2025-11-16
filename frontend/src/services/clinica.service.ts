import { api } from './api';
import { IClinica } from '../types/models';

export interface ClinicaCreateInput {
  nome: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  adminNome: string;
  adminEmail: string;
  adminSenha: string;
  horarioInicio?: string;
  horarioFim?: string;
  pausaInicio?: string;
  pausaFim?: string;
}

type ClinicaUpdateInput = Partial<Omit<IClinica, 'id' | 'webhookUrlId'>>;

export const getClinicas = async () => {
  const response = await api.get<IClinica[]>('/clinicas');
  return response.data;
};

export const getMinhaClinica = async () => {
  const response = await api.get<IClinica>('/clinica/atual');
  return response.data;
};

export const createClinicaEAdmin = async (data: ClinicaCreateInput) => {
  const response = await api.post<IClinica>('/clinicas', data);
  return response.data;
};

export const updateClinica = async (id: number, data: ClinicaUpdateInput) => {
  const response = await api.put<IClinica>(`/clinicas/${id}`, data);
  return response.data;
};

export const deleteClinica = async (id: number) => {
  await api.delete(`/clinicas/${id}`);
};

export const renovarWebhookVerifyToken = async (id: number) => {
  const response = await api.post<IClinica>(`/clinicas/${id}/renovar-webhook-token`);
  return response.data;
};

