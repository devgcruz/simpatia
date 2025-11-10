import { api } from './api';

export const getAgendamentos = async (filtros?: Record<string, unknown>) => {
  const response = await api.get('/agendamentos', { params: filtros });
  return response.data;
};

