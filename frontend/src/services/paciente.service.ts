import { api } from './api';
import { IPaciente, IHistoricoPaciente } from '../types/models';

type PacienteInput = Omit<IPaciente, 'id' | 'clinicaId'>;

export const getPacientes = async (doutorId?: number) => {
  const params = doutorId ? { doutorId } : {};
  const response = await api.get<IPaciente[]>('/pacientes', { params });
  return response.data;
};

export const createPaciente = async (data: PacienteInput) => {
  const response = await api.post<IPaciente>('/pacientes', data);
  return response.data;
};

export const updatePaciente = async (id: number, data: Partial<PacienteInput>) => {
  const response = await api.put<IPaciente>(`/pacientes/${id}`, data);
  return response.data;
};

export const deletePaciente = async (id: number) => {
  await api.delete(`/pacientes/${id}`);
};

export const getPacienteHistoricos = async (pacienteId: number) => {
  const response = await api.get<IHistoricoPaciente[]>(`/pacientes/${pacienteId}/historicos`);
  return response.data;
};

export const updateHistoricoPaciente = async (historicoId: number, descricao: string) => {
  const response = await api.put<IHistoricoPaciente>(`/pacientes/historicos/${historicoId}`, { descricao });
  return response.data;
};

