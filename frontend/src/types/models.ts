export interface IServico {
  id: number;
  nome: string;
  descricao: string;
  duracaoMin: number;
  preco: number;
  clinicaId: number;
  doutorId?: number;
  doutor?: {
    id: number;
    nome: string;
  };
}

export interface IPaciente {
  id: number;
  nome: string;
  telefone: string;
  cpf?: string | null;
  dataNascimento?: string | null;
  genero?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  convenio?: string | null;
  numeroCarteirinha?: string | null;
  alergias?: string | null;
  observacoes?: string | null;
  pesoKg?: number | null;
  alturaCm?: number | null;
  clinicaId: number;
  doutorId?: number | null;
  doutor?: {
    id: number;
    nome: string;
    email: string;
  };
}

export type DoutorRole = 'DOUTOR' | 'CLINICA_ADMIN' | 'SUPER_ADMIN';

export interface IDoutor {
  id: number;
  nome: string;
  email: string;
  especialidade?: string;
  crm?: string; // Número do CRM
  crmUf?: string; // UF do CRM
  rqe?: string; // RQE (Registro de Qualificação de Especialista)
  role: DoutorRole;
  clinicaId?: number;
  pausaInicio?: string;
  pausaFim?: string;
  diasBloqueados?: number[]; // Array de dias da semana bloqueados (0 = Domingo, 6 = Sábado)
  modeloPrescricao?: string; // JSON do modelo de prescrição personalizado (IModeloPrescricaoPDF)
  clinica?: {
    nome: string;
    cnpj?: string;
    endereco?: string;
    telefone?: string;
    email?: string;
    site?: string;
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
  protocolo: string; // Protocolo único do atendimento
  descricao: string;
  realizadoEm: string;
  criadoEm: string;
  agendamentoId?: number | null;
  agendamento?: {
    id: number;
    dataHora: string;
    servico: {
      nome: string;
      duracaoMin: number;
    };
  } | null;
  servico?: Pick<IServico, 'id' | 'nome' | 'duracaoMin'> | null;
  doutor?: Pick<IDoutor, 'id' | 'nome' | 'email'> | null;
}

export interface IPrescricao {
  id: number;
  protocolo: string; // Protocolo único da prescrição
  conteudo: string;
  pacienteId: number;
  doutorId: number;
  agendamentoId?: number | null;
  createdAt: string;
  doutor: {
    id: number;
    nome: string;
    especialidade?: string;
  };
  agendamento?: {
    id: number;
    dataHora: string;
    servico: {
      nome: string;
    };
  } | null;
}

export type ProntuarioChatSender = 'IA' | 'DOUTOR';

export interface IProntuarioChatMessage {
  id: number;
  agendamentoId: number;
  sender: ProntuarioChatSender;
  content: string;
  createdAt: string;
}

export interface IClinica {
  id: number;
  nome: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  site?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
  webhookUrlId: string;
  webhookVerifyToken?: string;
  horarioInicio?: string;
  horarioFim?: string;
  pausaInicio?: string;
  pausaFim?: string;
}