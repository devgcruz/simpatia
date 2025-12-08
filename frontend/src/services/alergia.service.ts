import { api } from './api';

export interface IAlergiaMedicamento {
  id: number;
  pacienteId: number;
  medicamentoId?: number;
  nomeMedicamento: string;
  principioAtivo: string;
  classeQuimica?: string;
  excipientes?: string;
  observacoes?: string;
  cadastradoPor: number;
  createdAt: string;
  updatedAt: string;
  medicamento?: {
    id: number;
    nomeProduto: string;
    principioAtivo?: string;
  };
}

export interface CreateAlergiaInput {
  pacienteId: number;
  medicamentoId?: number;
  nomeMedicamento: string;
  principioAtivo: string; // OBRIGATÓRIO
  classeQuimica?: string;
  excipientes?: string;
  observacoes?: string;
}

export interface VerificacaoAlergia {
  temAlergia: boolean;
  motivo?: 'principio_ativo' | 'classe_quimica' | 'excipiente' | 'nome_comercial';
  alergiaEncontrada?: {
    principioAtivo: string;
    classeQuimica?: string;
    excipientes?: string;
  };
}

export const getAlergiasByPaciente = async (pacienteId: number): Promise<IAlergiaMedicamento[]> => {
  const response = await api.get<IAlergiaMedicamento[]>(`/alergias/paciente/${pacienteId}`);
  return response.data;
};

export const createAlergia = async (data: CreateAlergiaInput): Promise<IAlergiaMedicamento> => {
  const response = await api.post<IAlergiaMedicamento>('/alergias', data);
  return response.data;
};

export const verificarAlergia = async (
  pacienteId: number, 
  nomeMedicamento: string, 
  principioAtivo?: string,
  classeTerapeutica?: string,
  excipientes?: string
): Promise<VerificacaoAlergia> => {
  const response = await api.post<VerificacaoAlergia>(`/alergias/paciente/${pacienteId}/verificar`, {
    nomeMedicamento,
    principioAtivo,
    classeTerapeutica,
    excipientes,
  });
  return response.data;
};

export const verificarAlergiasEmMedicamentos = async (
  pacienteId: number,
  medicamentos: Array<{ nome: string; principioAtivo?: string }>
): Promise<Array<{ nome: string; temAlergia: boolean }>> => {
  const response = await api.post<Array<{ nome: string; temAlergia: boolean }>>(
    `/alergias/paciente/${pacienteId}/verificar-multiplos`,
    { medicamentos }
  );
  return response.data;
};

export const updateAlergia = async (id: number, data: Partial<CreateAlergiaInput>): Promise<IAlergiaMedicamento> => {
  const response = await api.put<IAlergiaMedicamento>(`/alergias/${id}`, data);
  return response.data;
};

export const deleteAlergia = async (id: number, justificativaExclusao: string): Promise<void> => {
  await api.delete(`/alergias/${id}`, {
    data: { justificativaExclusao },
  });
};

