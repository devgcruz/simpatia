import { api } from './api';

export interface ConversaInterna {
  id: number;
  tipo: 'INDIVIDUAL' | 'GRUPO';
  nome?: string;
  descricao?: string;
  clinicaId: number;
  criadoPor: number;
  createdAt: string;
  updatedAt: string;
  participantes: ParticipanteConversa[];
  mensagens?: MensagemInterna[];
  mensagensNaoLidas?: number;
}

export interface ParticipanteConversa {
  id: number;
  conversaId: number;
  usuarioId: number;
  usuario: {
    id: number;
    nome: string;
    email: string;
    role: string;
  };
  ultimaLeitura?: string;
  notificacoes: boolean;
}

export interface MensagemInterna {
  id: number;
  conversaId: number;
  remetenteId: number;
  remetente: {
    id: number;
    nome: string;
    email: string;
    role: string;
  };
  tipo: 'TEXTO' | 'IMAGEM' | 'PDF' | 'EMOJI';
  conteudo: string;
  status: 'ENVIADA' | 'ENTREGUE' | 'LIDA';
  editada: boolean;
  createdAt: string;
  lida?: boolean;
}

export interface UsuarioOnline {
  id: number;
  online: boolean;
  ultimaVezOnline?: string;
  digitandoEmConversaId?: number;
  usuario: {
    id: number;
    nome: string;
    email: string;
    role: string;
  };
}

class ChatInternoService {
  async createConversaIndividual(usuarioId2: number) {
    const response = await api.post<ConversaInterna>('/chat-interno/conversas/individual', {
      usuarioId2,
    });
    return response.data;
  }

  async createConversaGrupo(data: { nome: string; descricao?: string; participantesIds: number[] }) {
    const response = await api.post<ConversaInterna>('/chat-interno/conversas/grupo', data);
    return response.data;
  }

  async listConversas() {
    const response = await api.get<ConversaInterna[]>('/chat-interno/conversas');
    return response.data;
  }

  async getMensagens(conversaId: number, page: number = 1, limit: number = 50) {
    const response = await api.get<{
      mensagens: MensagemInterna[];
      paginacao: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/chat-interno/conversas/${conversaId}/mensagens`, {
      params: { page, limit },
    });
    return response.data;
  }

  async sendMensagem(data: {
    conversaId: number;
    tipo: 'TEXTO' | 'IMAGEM' | 'PDF' | 'EMOJI';
    conteudo: string;
    criptografar?: boolean;
  }) {
    const response = await api.post<MensagemInterna>('/chat-interno/mensagens', data);
    return response.data;
  }

  async marcarMensagensComoLidas(conversaId: number) {
    const response = await api.post<{ marcadas: number }>(
      `/chat-interno/conversas/${conversaId}/marcar-lidas`
    );
    return response.data;
  }

  async adicionarParticipante(conversaId: number, usuarioId: number) {
    const response = await api.post<ParticipanteConversa>(
      `/chat-interno/conversas/${conversaId}/participantes`,
      { usuarioId }
    );
    return response.data;
  }

  async removerParticipante(conversaId: number, usuarioId: number) {
    const response = await api.delete<{ sucesso: boolean }>(
      `/chat-interno/conversas/${conversaId}/participantes`,
      { data: { usuarioId } }
    );
    return response.data;
  }

  async getUsuariosOnline() {
    const response = await api.get<UsuarioOnline[]>('/chat-interno/usuarios/online');
    return response.data;
  }

  async getUsuariosDisponiveis() {
    const response = await api.get<any[]>('/chat-interno/usuarios/disponiveis');
    return response.data;
  }

  async buscarConversas(termo: string) {
    const response = await api.get<ConversaInterna[]>('/chat-interno/conversas/buscar', {
      params: { termo },
    });
    return response.data;
  }
}

export default new ChatInternoService();

