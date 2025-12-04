import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { MensagemInterna } from '../services/chat-interno.service';

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

function ensureSecureWebSocketUrl(url: string): string {
  const isProduction = import.meta.env.MODE === 'production';
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

  if (!isProduction && isLocalhost) {
    return url;
  }

  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === 'http:') {
      urlObj.protocol = 'https:';
    }
    if (urlObj.protocol === 'ws:') {
      urlObj.protocol = 'wss:';
    }
    if (urlObj.protocol !== 'https:') {
      urlObj.protocol = 'https:';
    }
    return urlObj.toString();
  } catch (error) {
    return url.replace(/^http:\/\//, 'https://').replace(/^ws:\/\//, 'wss://');
  }
}

interface UseChatInternoWebSocketOptions {
  conversaId?: number | null;
  onNovaMensagem?: (mensagem: MensagemInterna) => void;
  onMensagensLidas?: (data: { conversaId: number; usuarioId: number; quantidade: number }) => void;
  onDigitando?: (data: { conversaId: number; usuarioId: number; digitando: boolean }) => void;
  onUsuarioOnline?: (data: { userId: number; nome?: string }) => void;
  onUsuarioOffline?: (data: { userId: number }) => void;
  enabled?: boolean;
}

export const useChatInternoWebSocket = (options: UseChatInternoWebSocketOptions = {}) => {
  const {
    conversaId,
    onNovaMensagem,
    onMensagensLidas,
    onDigitando,
    onUsuarioOnline,
    onUsuarioOffline,
    enabled = true,
  } = options;

  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs para callbacks
  const onNovaMensagemRef = useRef(onNovaMensagem);
  const onMensagensLidasRef = useRef(onMensagensLidas);
  const onDigitandoRef = useRef(onDigitando);
  const onUsuarioOnlineRef = useRef(onUsuarioOnline);
  const onUsuarioOfflineRef = useRef(onUsuarioOffline);

  useEffect(() => {
    onNovaMensagemRef.current = onNovaMensagem;
    onMensagensLidasRef.current = onMensagensLidas;
    onDigitandoRef.current = onDigitando;
    onUsuarioOnlineRef.current = onUsuarioOnline;
    onUsuarioOfflineRef.current = onUsuarioOffline;
  }, [onNovaMensagem, onMensagensLidas, onDigitando, onUsuarioOnline, onUsuarioOffline]);

  useEffect(() => {
    if (!enabled || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';
    let WS_URL = API_BASE_URL.replace('/api', '');
    WS_URL = ensureSecureWebSocketUrl(WS_URL);

    // Tentar obter token do cookie (pode ser null se for HTTPOnly)
    // O cookie será enviado automaticamente com withCredentials: true
    const token = getTokenFromCookie();

    const isProduction = import.meta.env.MODE === 'production';
    const isLocalhost = WS_URL.includes('localhost') || WS_URL.includes('127.0.0.1');
    const useSecure = isProduction || !isLocalhost;

    const socket = io(WS_URL, {
      path: '/chat-interno-socket.io',
      transports: useSecure ? ['websocket'] : ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 5,
      // Enviar token se disponível (cookie HTTPOnly será enviado automaticamente)
      ...(token
        ? {
          extraHeaders: {
            Authorization: `Bearer ${token}`,
          },
          auth: {
            token: token,
          },
        }
        : {}),
      // IMPORTANTE: withCredentials permite que cookies HTTPOnly sejam enviados
      withCredentials: true,
      secure: useSecure,
      rejectUnauthorized: useSecure,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Chat Interno WebSocket] Conectado');

      // Entrar na conversa se especificada
      if (conversaId) {
        socket.emit('conversa:entrar', { conversaId });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Chat Interno WebSocket] Desconectado');
    });

    socket.on('conversa:entrada-confirmada', (data: { conversaId: number }) => {
      console.log('[Chat Interno WebSocket] Entrada confirmada na conversa:', data.conversaId);
    });

    socket.on('mensagem:nova', (mensagem: MensagemInterna) => {
      console.log('[WebSocket Hook] mensagem:nova received:', mensagem);
      if (onNovaMensagemRef.current) {
        onNovaMensagemRef.current(mensagem);
      }
    });

    socket.on('mensagens:lidas', (data: { conversaId: number; usuarioId: number; quantidade: number }) => {
      if (onMensagensLidasRef.current) {
        onMensagensLidasRef.current(data);
      }
    });

    socket.on('digitando:status', (data: { conversaId: number; usuarioId: number; digitando: boolean }) => {
      if (onDigitandoRef.current) {
        onDigitandoRef.current(data);
      }
    });

    socket.on('usuario:online', (data: { userId: number; nome?: string }) => {
      if (onUsuarioOnlineRef.current) {
        onUsuarioOnlineRef.current(data);
      }
    });

    socket.on('usuario:offline', (data: { userId: number }) => {
      if (onUsuarioOfflineRef.current) {
        onUsuarioOfflineRef.current(data);
      }
    });

    socket.on('erro', (data: { message: string }) => {
      console.error('[Chat Interno WebSocket] Erro:', data.message);
    });

    socket.on('connect_error', (error: any) => {
      console.error('[Chat Interno WebSocket] Erro de conexão:', error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, user]);

  // Entrar/sair da conversa quando conversaId mudar
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && conversaId) {
      socketRef.current.emit('conversa:entrar', { conversaId });
    }
  }, [conversaId]);

  const enviarMensagem = useCallback(
    (data: { conversaId: number; tipo: string; conteudo: string; criptografar?: boolean }) => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('mensagem:enviar', data);
      }
    },
    []
  );

  const marcarMensagensComoLidas = useCallback((conversaId: number) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('mensagens:marcar-lidas', { conversaId });
    }
  }, []);

  const iniciarDigitando = useCallback((conversaId: number) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('digitando:iniciar', { conversaId });
    }
  }, []);

  const pararDigitando = useCallback((conversaId: number) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('digitando:parar', { conversaId });
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    enviarMensagem,
    marcarMensagensComoLidas,
    iniciarDigitando,
    pararDigitando,
  };
};

