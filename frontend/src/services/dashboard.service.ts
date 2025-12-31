import { api } from './api';

export interface IDashboardMetrics {
  faturamentoMensal: number;
  atendimentosHoje: number;
  atendimentosMes: number;
  novosPacientes: number;
  taxaOcupacao: number;
  topDoutores: Array<{
    nome: string;
    especialidade: string | null;
    atendimentos: number;
  }>;
  atendimentosUltimos7Dias: Array<{
    dia: string;
    quantidade: number;
  }>;
}

export const getDashboardMetrics = async (): Promise<IDashboardMetrics> => {
  const response = await api.get<IDashboardMetrics>('/dashboard/metrics');
  return response.data;
};

