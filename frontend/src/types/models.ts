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
  clinicaId?: number;
  pausaInicio?: string;
  pausaFim?: string;
  diasBloqueados?: number[]; // Array de dias da semana bloqueados (0 = Domingo, 6 = Sábado)
  clinica?: {
    nome: string;
  }
}

export interface IAgendamento {
  id: number;
  dataHora: string;
  status: string;
  relatoPaciente?: string | null;
  entendimentoIA?: string | null;
  paciente: IPaciente;
  doutor: IDoutor;
  servico: IServico;
}

export interface IHistoricoPaciente {
  id: number;
  descricao: string;
  realizadoEm: string;
  criadoEm: string;
  agendamentoId?: number | null;
  servico?: Pick<IServico, 'id' | 'nome' | 'duracaoMin'> | null;
  doutor?: Pick<IDoutor, 'id' | 'nome' | 'email'> | null;
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
  webhookVerifyToken?: string;
  horarioInicio?: string;
  horarioFim?: string;
  pausaInicio?: string;
  pausaFim?: string;
}