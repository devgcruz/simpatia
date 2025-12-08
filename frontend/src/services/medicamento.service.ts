import { api } from './api';
import { IMedicamento } from '../types/models';

export interface MedicamentoFilters {
  nomeProduto?: string;
  numeroRegistroProduto?: string;
  classeTerapeutica?: string;
  categoriaRegulatoria?: string;
  situacaoRegistro?: string;
  principioAtivo?: string;
  empresaDetentoraRegistro?: string;
  skip?: number;
  take?: number;
}

export interface MedicamentoListResponse {
  medicamentos: IMedicamento[];
  total: number;
  skip: number;
  take: number;
}

export type MedicamentoInput = Omit<IMedicamento, 'id' | 'createdAt' | 'updatedAt'>;

export const getMedicamentos = async (filters?: MedicamentoFilters) => {
  const params = filters || {};
  const response = await api.get<MedicamentoListResponse>('/medicamentos', { params });
  return response.data;
};

export const getMedicamentoById = async (id: number) => {
  const response = await api.get<IMedicamento>(`/medicamentos/${id}`);
  return response.data;
};

export const createMedicamento = async (data: MedicamentoInput) => {
  const response = await api.post<IMedicamento>('/medicamentos', data);
  return response.data;
};

export const updateMedicamento = async (id: number, data: Partial<MedicamentoInput>) => {
  const response = await api.put<IMedicamento>(`/medicamentos/${id}`, data);
  return response.data;
};

export const deleteMedicamento = async (id: number) => {
  await api.delete(`/medicamentos/${id}`);
};

export const bulkCreateMedicamentos = async (medicamentos: MedicamentoInput[]) => {
  const response = await api.post<{ message: string; count: number }>('/medicamentos/bulk', {
    medicamentos,
  });
  return response.data;
};

export const getPrincipiosAtivos = async (busca?: string): Promise<string[]> => {
  const params = busca ? { busca } : {};
  const response = await api.get<string[]>('/medicamentos/principios-ativos', { params });
  return response.data;
};

export const verificarPrincipioAtivoExiste = async (principioAtivo: string): Promise<boolean> => {
  const response = await api.post<{ existe: boolean }>('/medicamentos/verificar-principio-ativo', {
    principioAtivo,
  });
  return response.data.existe;
};

