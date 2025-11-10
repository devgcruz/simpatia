export interface IServico {
  id: number;
  nome: string;
  descricao: string;
  duracaoMin: number;
  preco: number;
  clinicaId: number;
}

export interface IPaciente {
  id: number;
  nome: string;
  telefone: string;
  clinicaId: number;
}

export type DoutorRole = 'DOUTOR' | 'CLINICA_ADMIN' | 'SUPER_ADMIN';

export interface IDoutor {
  id: number;
  nome: string;
  email: string;
  especialidade?: string;
  role: DoutorRole;
}

export interface IAgendamento {
  id: number;
  dataHora: string;
  status: string;
  paciente: IPaciente;
  doutor: IDoutor;
  servico: IServico;
}

export interface IClinica {
  id: number;
  nome: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
  webhookUrlId: string;
}