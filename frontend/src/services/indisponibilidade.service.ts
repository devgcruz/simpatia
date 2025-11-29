import { api } from './api';

export interface Indisponibilidade {
  id: number;
  inicio: string;
  fim: string;
  motivo?: string | null;
  doutor?: { id: number; nome: string };
  inicioFormatado?: string;
  fimFormatado?: string;
}

export interface CreateIndisponibilidadeInput {
  doutorId: number;
  inicio: string; // ISO
  fim: string;    // ISO
  motivo?: string;
}

export const listarIndisponibilidadesDaClinica = async () => {
  const res = await api.get<Indisponibilidade[]>('/indisponibilidades');
  return res.data;
};

export const listarIndisponibilidadesDoDoutor = async (doutorId: number) => {
  const res = await api.get<Indisponibilidade[]>(`/indisponibilidades/doutor/${doutorId}`);
  return res.data;
};

export const criarIndisponibilidade = async (input: CreateIndisponibilidadeInput) => {
  const res = await api.post<Indisponibilidade>('/indisponibilidades', input);
  return res.data;
};

export interface UpdateIndisponibilidadeInput {
  doutorId?: number;
  inicio?: string; // ISO
  fim?: string;    // ISO
  motivo?: string;
}

export const atualizarIndisponibilidade = async (id: number, input: UpdateIndisponibilidadeInput) => {
  const res = await api.put<Indisponibilidade>(`/indisponibilidades/${id}`, input);
  return res.data;
};

export const excluirIndisponibilidade = async (id: number) => {
  await api.delete(`/indisponibilidades/${id}`);
};


