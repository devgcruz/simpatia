import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

/**
 * Função helper para obter o token do cookie
 */
function getTokenFromCookie(): string | null {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Função helper para garantir que a URL use HTTPS/WSS em produção
 * Em desenvolvimento local, permite HTTP/WS
 */
function ensureSecureWebSocketUrl(url: string): string {
  const isProduction = import.meta.env.MODE === 'production';
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
  
  // Em desenvolvimento local, permitir HTTP/WS
  if (!isProduction && isLocalhost) {
    return url;
  }
  
  // Em produção, forçar HTTPS/WSS
  try {
    const urlObj = new URL(url);
    
    // Se for http://, converter para https://
    if (urlObj.protocol === 'http:') {
      urlObj.protocol = 'https:';
    }
    
    // Se for ws://, converter para wss://
    if (urlObj.protocol === 'ws:') {
      urlObj.protocol = 'wss:';
    }
    
    // Garantir que sempre use https:// (Socket.io converterá para wss:// automaticamente)
    if (urlObj.protocol !== 'https:') {
      urlObj.protocol = 'https:';
    }
    
    return urlObj.toString();
  } catch (error) {
    // Se não conseguir parsear, tentar substituição simples
    return url.replace(/^http:\/\//, 'https://').replace(/^ws:\/\//, 'wss://');
  }
}

interface AgendamentoEvent {
  action: 'created' | 'updated' | 'deleted' | 'finalized' | 'encaixe_confirmed';
  agendamento: any | null;
  doutorId: number;
  clinicaId: number;
}

interface UseWebSocketOptions {
  doutorId?: number | null;
  onAgendamentoUpdate?: (event: AgendamentoEvent) => void;
  enabled?: boolean;
}

// Armazenar referência global do socket para permitir desconexão no logout
let globalSocketRef: Socket | null = null;

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const { doutorId, onAgendamentoUpdate, enabled = true } = options;
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const onAgendamentoUpdateRef = useRef(onAgendamentoUpdate);


  // Atualizar referência do callback quando mudar
  useEffect(() => {
    onAgendamentoUpdateRef.current = onAgendamentoUpdate;
  }, [onAgendamentoUpdate]);

  useEffect(() => {
    if (!enabled) {
      // Se já existe uma conexão, desconectar
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        globalSocketRef = null;
      }
      return;
    }
    
    if (!user) {
      // Se já existe uma conexão, desconectar
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        globalSocketRef = null;
      }
      return;
    }

    // Se já existe uma conexão ativa e conectada, apenas atualizar a inscrição se necessário
    if (socketRef.current && socketRef.current.connected) {
      // Se o doutorId mudou, atualizar a inscrição sem reconectar
      if (doutorId && socketRef.current.connected) {
        socketRef.current.emit('subscribe:doutor', doutorId);
      }
      return;
    }

    // Se já existe uma conexão mas não está conectada, aguardar um pouco antes de tentar novamente
    if (socketRef.current && !socketRef.current.connected) {
      // Limpar a conexão antiga apenas se não estiver tentando conectar
      // Verificar se está em processo de conexão verificando o estado do manager
      const manager = socketRef.current.io;
      const isConnecting = manager && (manager as any)._reconnecting !== false;
      if (!isConnecting) {
        socketRef.current.disconnect();
        socketRef.current = null;
        globalSocketRef = null;
      } else {
        return;
      }
    }

    // Usar a mesma URL base da API, mas sem o /api
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';
    // Remover /api se estiver presente, pois o WebSocket não precisa disso
    let WS_URL = API_BASE_URL.replace('/api', '');
    
    // FORÇAR uso de HTTPS/WSS - sempre usar conexão segura
    WS_URL = ensureSecureWebSocketUrl(WS_URL);
    
    // IMPORTANTE: O token está em um cookie HTTPOnly (não pode ser lido via JavaScript)
    // O Socket.io enviará o cookie automaticamente com withCredentials: true
    // O backend lerá o cookie HTTPOnly no handshake
    // Tentar obter token do cookie (pode falhar se for HTTPOnly, mas tentamos mesmo assim)
    const token = getTokenFromCookie();

    // Prevenir múltiplas conexões zumbis
    if (globalSocketRef && globalSocketRef.connected) {
      globalSocketRef.disconnect();
      globalSocketRef = null;
    }

    // Determinar se deve usar conexão segura baseado no ambiente
    const isProduction = import.meta.env.MODE === 'production';
    const isLocalhost = WS_URL.includes('localhost') || WS_URL.includes('127.0.0.1');
    // Em desenvolvimento local, não usar conexão segura (HTTP/WS)
    // Em produção ou desenvolvimento não-localhost, usar conexão segura (HTTPS/WSS)
    const useSecure = isProduction || !isLocalhost;
    
    const socket = io(WS_URL, {
      // Em desenvolvimento local, permitir polling como fallback
      // Em produção, usar apenas websocket seguro
      transports: useSecure ? ['websocket'] : ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000, // Delay inicial
      reconnectionDelayMax: 10000, // Delay máximo (10 segundos)
      reconnectionAttempts: 5,
      // Backoff exponencial: delay aumenta exponencialmente a cada tentativa
      randomizationFactor: 0.5, // Adiciona aleatoriedade para evitar thundering herd
      // Enviar token no handshake via Authorization header (se disponível)
      // Se o token estiver em cookie HTTPOnly, não será enviado aqui, mas o cookie será enviado automaticamente
      ...(token ? {
        extraHeaders: {
          Authorization: `Bearer ${token}`,
        },
        auth: {
          token: token,
        },
      } : {}),
      // Enviar cookies (com withCredentials)
      withCredentials: true,
      // Forçar uso de SSL/TLS apenas em produção ou não-localhost
      secure: useSecure,
      rejectUnauthorized: useSecure, // Em produção, validar certificado
    });

    socketRef.current = socket;
    globalSocketRef = socket; // Armazenar referência global

    socket.on('connect', () => {
      // Inscrever-se na clínica do usuário
      if (user.clinicaId) {
        socket.emit('subscribe:clinica', user.clinicaId);
      }

      // Inscrever-se no doutor se especificado
      // Usar o doutorId atual do hook (pode ter mudado desde a criação do socket)
      const currentDoutorId = doutorId;
      if (currentDoutorId) {
        socket.emit('subscribe:doutor', currentDoutorId);
      }
    });

    socket.on('disconnect', () => {
      // Silencioso - desconexão é normal
    });

    // Listener para evento de logout do servidor
    socket.on('logout', (data: { message: string }) => {
      socket.disconnect();
      globalSocketRef = null;
    });

    socket.on('connect_error', (error: any) => {
      console.error('[WebSocket] ❌ Erro de conexão:', error);
      console.error('[WebSocket] Detalhes do erro:', {
        message: error.message,
        type: error.type,
        description: error.description,
        data: error.data,
        WS_URL,
        useSecure,
        isProduction,
        isLocalhost,
        tokenPresent: !!token,
      });
      // Se o erro for de autenticação, tentar reconectar com novo token
      if (error.message?.includes('Autenticação falhou') || error.message?.includes('Token')) {
        console.warn('[WebSocket] ⚠️ Erro de autenticação. Verifique se o token é válido.');
      }
    });

    socket.on('error', (error: any) => {
      console.error('[WebSocket] Erro no socket:', error);
      if (error.message) {
        console.error('[WebSocket] Mensagem de erro:', error.message);
      }
    });

    socket.on('agendamento:updated', (event: AgendamentoEvent) => {
      // Chamar callback se fornecido
      if (onAgendamentoUpdateRef.current) {
        try {
          onAgendamentoUpdateRef.current(event);
        } catch (error) {
          console.error('[WebSocket] Erro ao executar callback onAgendamentoUpdate:', error);
        }
      }
    });

    return () => {
      // Só desconectar se realmente necessário (enabled=false ou user=null)
      // Não desconectar apenas porque doutorId mudou
      if (!enabled || !user) {
        socket.disconnect();
        socketRef.current = null;
        if (globalSocketRef === socket) {
          globalSocketRef = null;
        }
      }
    };
  }, [enabled, user]); // Remover doutorId das dependências para evitar reconexões

  // Atualizar inscrição quando doutorId mudar (sem reconectar)
  // Este useEffect está no nível do componente, não dentro de outro useEffect
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && doutorId) {
      socketRef.current.emit('subscribe:doutor', doutorId);
    }
  }, [doutorId]);

  // Função para atualizar a inscrição do doutor
  const subscribeToDoutor = useCallback((newDoutorId: number | null) => {
    if (!socketRef.current) {
      return;
    }
    
    if (!socketRef.current.connected) {
      // Aguardar conexão e então inscrever
      socketRef.current.once('connect', () => {
        if (newDoutorId) {
          socketRef.current?.emit('subscribe:doutor', newDoutorId);
        }
      });
      return;
    }

    // Inscrever no novo doutor (o servidor gerencia as salas automaticamente)
    if (newDoutorId) {
      socketRef.current.emit('subscribe:doutor', newDoutorId);
    }
  }, []);

  return {
    socket: socketRef.current,
    subscribeToDoutor,
    isConnected: socketRef.current?.connected || false,
    // Adicionar estado de conexão para debug
    connectionState: socketRef.current?.connected ? 'connected' : socketRef.current ? 'connecting' : 'disconnected',
  };
};

/**
 * Função para desconectar o WebSocket globalmente
 * Usada quando o usuário faz logout
 */
export const disconnectWebSocket = () => {
  if (globalSocketRef) {
    globalSocketRef.disconnect();
    globalSocketRef = null;
  }
};

