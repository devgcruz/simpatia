import { api } from './api';

export interface Horario {
  id: number;
  diaSemana: number; // 0 = Domingo, 1 = Segunda, etc.
  inicio: string; // "08:00"
  fim: string; // "18:00"
  pausaInicio?: string | null; // "12:00"
  pausaFim?: string | null; // "14:00"
  doutorId: number;
  ativo: boolean;
}

export interface CreateHorarioInput {
  diaSemana: number;
  inicio: string;
  fim: string;
  pausaInicio?: string | null;
  pausaFim?: string | null;
  doutorId: number;
}

export interface UpdateHorarioInput {
  diaSemana?: number;
  inicio?: string;
  fim?: string;
  pausaInicio?: string | null;
  pausaFim?: string | null;
  doutorId?: number;
}

export const getHorariosByDoutor = async (doutorId: number) => {
  const res = await api.get<Horario[]>(`/horarios/doutor/${doutorId}`);
  return res.data;
};

export const createHorario = async (data: CreateHorarioInput) => {
  const res = await api.post<Horario>('/horarios', data);
  return res.data;
};

export const updateHorario = async (id: number, data: UpdateHorarioInput) => {
  const res = await api.put<Horario>(`/horarios/${id}`, data);
  return res.data;
};

export const deleteHorario = async (id: number) => {
  await api.delete(`/horarios/${id}`);
};

