// Types para Atestado Médico

export interface IAtestado {
  id: number;
  protocolo: string;
  diasAfastamento: number;
  horaInicial?: string | null;
  horaFinal?: string | null;
  cid?: string | null;
  exibirCid: boolean;
  conteudo: string;
  localAtendimento?: string | null;
  dataAtestado?: string | null;
  pacienteId: number;
  doutorId: number;
  agendamentoId?: number | null;
  createdAt: string;
  paciente?: {
    id: number;
    nome: string;
    cpf?: string | null;
  };
  doutor?: {
    id: number;
    nome: string;
    especialidade?: string | null;
    crm?: string | null;
    crmUf?: string | null;
    rqe?: string | null;
    clinica?: {
      id: number;
      nome: string;
      cnpj?: string | null;
      endereco?: string | null;
      telefone?: string | null;
      email?: string | null;
      site?: string | null;
    };
  };
  agendamento?: {
    id: number;
    dataHora: string;
    servico?: {
      nome: string;
    };
  } | null;
}

