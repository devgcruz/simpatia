/**
 * Estado estruturado do fluxo de agendamento gerenciado pela IA.
 * Este estado permite que a IA mantenha contexto estruturado durante a conversa.
 */
export interface AgendamentoState {
  /**
   * Etapa atual do fluxo de agendamento.
   */
  step: 'SAUDACAO' | 'COLETANDO_DADOS' | 'CONFIRMANDO' | 'CONCLUIDO';

  /**
   * Informações do paciente.
   */
  paciente: {
    nome: string | null;
    telefone: string;
  };

  /**
   * Intenção do paciente para o agendamento.
   */
  intencao: {
    servicoId: number | null;
    doutorId: number | null;
    dataDesejada: string | null; // ISO format (AAAA-MM-DD)
  };

  /**
   * Último erro ocorrido durante o processamento (se houver).
   */
  ultimoErro: string | null;
}

