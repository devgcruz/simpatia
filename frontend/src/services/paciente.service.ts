import { api } from './api';
import { IPaciente } from '../types/models';

type PacienteInput = Omit<IPaciente, 'id' | 'clinicaId'>;

export const getPacientes = async () => {
  const response = await api.get<IPaciente[]>('/pacientes');
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

