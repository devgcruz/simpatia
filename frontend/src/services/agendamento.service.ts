import { api } from './api';
import { IAgendamento } from '../types/models';

// Tipo para Criar
export type AgendamentoCreateInput = {
  dataHora: string; // Enviamos como string ISO
  status: string;
  pacienteId: number;
  doutorId: number;
  servicoId: number;
};

// Tipo para Atualizar (tudo opcional)
export type AgendamentoUpdateInput = Partial<AgendamentoCreateInput>;

export type AgendamentoFinalizeInput = {
  descricao: string;
};

// GET (Já existente)
export const getAgendamentos = async (filtros?: Record<string, unknown>) => {
  const response = await api.get<IAgendamento[]>('/agendamentos', { params: filtros });
  return response.data;
};

// --- ADICIONE ESTAS NOVAS FUNÇÕES ---

// Rota: POST /api/agendamentos
export const createAgendamento = async (data: AgendamentoCreateInput) => {
  const response = await api.post<IAgendamento>('/agendamentos', data);
  return response.data;
};

// Rota: PUT /api/agendamentos/:id
export const updateAgendamento = async (id: number, data: AgendamentoUpdateInput) => {
  const response = await api.put<IAgendamento>(`/agendamentos/${id}`, data);
  return response.data;
};

// Rota: DELETE /api/agendamentos/:id
export const deleteAgendamento = async (id: number) => {
  await api.delete(`/agendamentos/${id}`);
};

export const finalizeAgendamento = async (id: number, data: AgendamentoFinalizeInput) => {
  const response = await api.post<IAgendamento>(`/agendamentos/${id}/finalizar`, data);
  return response.data;
};
