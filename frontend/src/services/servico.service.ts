import { api } from './api';
import { IServico } from '../types/models';

type ServicoInput = Omit<IServico, 'id' | 'clinicaId'>;

export const getServicos = async () => {
  const response = await api.get<IServico[]>('/servicos');
  return response.data;
};

export const createServico = async (data: ServicoInput) => {
  const response = await api.post<IServico>('/servicos', data);
  return response.data;
};

export const updateServico = async (id: number, data: Partial<ServicoInput>) => {
  const response = await api.put<IServico>(`/servicos/${id}`, data);
  return response.data;
};

export const deleteServico = async (id: number) => {
  await api.delete(`/servicos/${id}`);
};
