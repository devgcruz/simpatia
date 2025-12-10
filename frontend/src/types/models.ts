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
  foto?: string | null;
  clinicaId: number;
  doutorId?: number | null;
  doutor?: {
    id: number;
    nome: string;
    email: string;
  };
}

export type DoutorRole = 'DOUTOR' | 'CLINICA_ADMIN' | 'SUPER_ADMIN' | 'SECRETARIA';

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
  isEncaixe?: boolean;
  confirmadoPorMedico?: boolean;
  motivoCancelamento?: string | null;
  canceladoPor?: number | null;
  canceladoEm?: string | null;
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
  duracaoMinutos?: number | null; // Duração do atendimento em minutos
  agendamentoId?: number | null;
  agendamento?: {
    id: number;
    dataHora: string;
    servico: {
      nome: string;
      duracaoMin: number;
    };
    prescricoes?: Array<{
      id: number;
      protocolo: string;
      conteudo: string;
      createdAt: string;
      agendamentoId?: number | null;
    }>;
    atestados?: Array<{
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
      createdAt: string;
      agendamentoId?: number | null;
    }>;
  } | null;
  servico?: Pick<IServico, 'id' | 'nome' | 'duracaoMin'> | null;
  doutor?: Pick<IDoutor, 'id' | 'nome' | 'email'> | null;
  prescricoes?: Array<{
    id: number;
    protocolo: string;
    conteudo: string;
    createdAt: string;
    agendamentoId?: number | null;
  }>;
  atestados?: Array<{
    id: number;
    protocolo: string;
    diasAfastamento: number;
    cid?: string | null;
    exibirCid: boolean;
    conteudo: string;
    localAtendimento?: string | null;
    dataAtestado?: string | null;
    createdAt: string;
    agendamentoId?: number | null;
  }>;
}

export interface IPrescricao {
  id: number;
  protocolo: string; // Protocolo único da prescrição
  conteudo: string;
  pacienteId: number;
  doutorId: number;
  agendamentoId?: number | null;
  createdAt: string;
  historicoId?: number | null; // ID do histórico do paciente que gerou a prescrição
  historicoProtocolo?: string | null; // Protocolo do histórico do paciente que gerou a prescrição
  doutor: {
    id: number;
    nome: string;
    especialidade?: string;
    crm?: string;
    crmUf?: string;
    rqe?: string;
    modeloPrescricao?: string;
    clinica?: {
      id: number;
      nome: string;
      cnpj?: string;
      endereco?: string;
      telefone?: string;
      email?: string;
      site?: string;
    };
  };
  agendamento?: {
    id: number;
    dataHora: string;
    servico: {
      nome: string;
    };
  } | null;
  paciente?: IPaciente;
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

export interface IMedicamento {
  id: number;
  tipoProduto?: string | null;
  nomeProduto: string;
  dataFinalizacaoProcesso?: string | null;
  categoriaRegulatoria?: string | null;
  numeroRegistroProduto?: string | null;
  dataVencimentoRegistro?: string | null;
  numeroProcesso?: string | null;
  classeTerapeutica?: string | null;
  empresaDetentoraRegistro?: string | null;
  situacaoRegistro?: string | null;
  principioAtivo?: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}