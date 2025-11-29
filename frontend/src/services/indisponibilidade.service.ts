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

export const criarIndisponibilidade = async (input: CreateIndisponibilidadeInput, ignorarConflitos: boolean = false) => {
  const params = ignorarConflitos ? { ignorarConflitos: 'true' } : {};
  const res = await api.post<Indisponibilidade>('/indisponibilidades', input, { params });
  return res.data;
};

export interface UpdateIndisponibilidadeInput {
  doutorId?: number;
  inicio?: string; // ISO
  fim?: string;    // ISO
  motivo?: string;
}

export const atualizarIndisponibilidade = async (id: number, input: UpdateIndisponibilidadeInput, ignorarConflitos: boolean = false) => {
  const params = ignorarConflitos ? { ignorarConflitos: 'true' } : {};
  const res = await api.put<Indisponibilidade>(`/indisponibilidades/${id}`, input, { params });
  return res.data;
};

export const excluirIndisponibilidade = async (id: number) => {
  await api.delete(`/indisponibilidades/${id}`);
};

// Interfaces para conflitos de agendamentos
export interface AgendamentoConflitante {
  id: number;
  dataHora: string;
  pacienteId: number;
  pacienteNome: string;
  servicoId: number;
  servicoNome: string;
  servicoDuracaoMin: number;
  status: string;
}

export interface SugestaoReagendamento {
  data: string; // YYYY-MM-DD
  horariosDisponiveis: string[]; // Array de horários no formato HH:mm
}

export interface ConflitoIndisponibilidade {
  message: string;
  code: 'CONFLITO_AGENDAMENTOS';
  agendamentosConflitantes: AgendamentoConflitante[];
  sugestoesReagendamento: Record<string, SugestaoReagendamento[]>; // Mapa: agendamentoId -> sugestões
}


