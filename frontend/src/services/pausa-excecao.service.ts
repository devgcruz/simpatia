import { api } from './api';

export interface PausaExcecao {
  id: number;
  data: string; // ISO date string
  pausaInicio: string; // "HH:MM"
  pausaFim: string; // "HH:MM"
  clinicaId?: number;
  doutorId?: number;
  clinica?: {
    id: number;
    nome: string;
  };
  doutor?: {
    id: number;
    nome: string;
  };
  createdAt: string;
}

export interface CreatePausaExcecaoInput {
  data: string; // ISO date string (YYYY-MM-DD)
  pausaInicio: string; // "HH:MM"
  pausaFim: string; // "HH:MM"
  doutorId?: number;
}

export interface UpdatePausaExcecaoInput {
  pausaInicio: string;
  pausaFim: string;
}

export const listarExcecoesDaClinica = async (startDate?: string, endDate?: string) => {
  const params: Record<string, string> = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const res = await api.get<PausaExcecao[]>('/pausa-excecoes/clinica', { params });
  return res.data;
};

export const listarExcecoesDoDoutor = async (doutorId: number, startDate?: string, endDate?: string) => {
  const params: Record<string, string> = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const res = await api.get<PausaExcecao[]>(`/pausa-excecoes/doutor/${doutorId}`, { params });
  return res.data;
};

export const criarExcecaoPausa = async (input: CreatePausaExcecaoInput) => {
  const res = await api.post<PausaExcecao>('/pausa-excecoes', input);
  return res.data;
};

export const atualizarExcecaoPausa = async (id: number, input: UpdatePausaExcecaoInput) => {
  const res = await api.put<PausaExcecao>(`/pausa-excecoes/${id}`, input);
  return res.data;
};

export const excluirExcecaoPausa = async (id: number) => {
  await api.delete(`/pausa-excecoes/${id}`);
};

