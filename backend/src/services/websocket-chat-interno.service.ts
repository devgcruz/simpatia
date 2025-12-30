import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.util';
import chatInternoService from './chat-interno.service';
import { prisma } from '../lib/prisma';
import { createAuditLog } from './audit.service';

let io: SocketIOServer | null = null;

// Mapeamento de usuários conectados: userId -> Set<socketId>
const usuariosConectados = new Map<number, Set<string>>();
// Mapeamento de sockets: socketId -> userId
const socketToUser = new Map<string, number>();
// Mapeamento de usuários digitando: conversaId -> Set<userId>
const usuariosDigitando = new Map<number, Set<number>>();

/**
 * Inicializa o WebSocket para o chat interno
 */
export function initializeChatInternoWebSocket(server: any) {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    path: '/chat-interno-socket.io',
    transports: ['websocket', 'polling'],
  });

  // Middleware de autenticação
  io.use(async (socket: Socket, next) => {
    try {
      // Tentar obter token de várias fontes (cookie HTTPOnly, auth header, query)
      const handshake = socket.handshake;
      const tokenFromAuth = handshake.auth?.token;
      const tokenFromHeader = handshake.headers.authorization?.replace('Bearer ', '');
      const tokenFromQuery = (handshake.query?.token as string) || undefined;
      
      // Tentar obter do cookie (via handshake.headers.cookie)
      let tokenFromCookie: string | undefined;
      const cookieHeader = handshake.headers.cookie;
      if (cookieHeader) {
        const cookies = cookieHeader.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'token' && value) {
            tokenFromCookie = decodeURIComponent(value);
            break;
          }
        }
      }

      const token = tokenFromAuth || tokenFromHeader || tokenFromQuery || tokenFromCookie;

      if (!token) {
        return next(new Error('Token não fornecido'));
      }

      // Verificar token usando RS256
      const payload = verifyToken(token);

      if (payload.type !== 'access') {
        return next(new Error('Token inválido: deve ser um access token'));
      }

      // Adicionar dados do usuário ao socket
      (socket as any).user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        clinicaId: payload.clinicaId,
      };

      next();
    } catch (error: any) {
      console.error('Erro na autenticação WebSocket:', error);
      next(new Error('Token inválido ou expirado'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = (socket as any).user;
    const userId = user.id;
    const clinicaId = user.clinicaId;

    console.log(`[Chat Interno] Usuário ${userId} conectado (socket: ${socket.id})`);

    // Registrar conexão
    if (!usuariosConectados.has(userId)) {
      usuariosConectados.set(userId, new Set());
    }
    usuariosConectados.get(userId)!.add(socket.id);
    socketToUser.set(socket.id, userId);

    // Atualizar status online
    await chatInternoService.updateStatusOnline(userId, true);

    // Entrar nas salas das conversas do usuário
    const conversas = await chatInternoService.listConversas(userId, clinicaId!);
    for (const conversa of conversas) {
      socket.join(`conversa:${conversa.id}`);
    }

    // Notificar outros usuários que este usuário está online
    socket.broadcast.emit('usuario:online', { userId, nome: user.nome });

    // Log de auditoria
    const ip = (socket.handshake.address as string) || 'unknown';
    const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
    await createAuditLog({
      usuarioId: userId,
      acao: 'WEBSOCKET_CONNECT',
      detalhes: JSON.stringify({ socketId: socket.id }),
      ip,
      userAgent,
    });

    // Evento: Entrar em uma conversa
    socket.on('conversa:entrar', async (data: { conversaId: number }) => {
      try {
        const { conversaId } = data;

        // Verificar se o usuário é participante
        const participante = await prisma.participanteConversa.findUnique({
          where: {
            conversaId_usuarioId: {
              conversaId,
              usuarioId: userId,
            },
          },
        });

        if (!participante) {
          socket.emit('erro', { message: 'Você não é participante desta conversa' });
          return;
        }

        socket.join(`conversa:${conversaId}`);
        socket.emit('conversa:entrada-confirmada', { conversaId });
      } catch (error: any) {
        socket.emit('erro', { message: error.message });
      }
    });

    // Evento: Enviar mensagem
    socket.on('mensagem:enviar', async (data: { conversaId: number; tipo: string; conteudo: string }) => {
      try {
        const { conversaId, tipo, conteudo } = data;

        // Verificar rate limit (máximo 20 mensagens por minuto)
        // TODO: Implementar rate limiting mais robusto

        // Enviar mensagem via serviço (criptografia é automática no servidor)
        const mensagem = await chatInternoService.sendMensagem({
          conversaId,
          remetenteId: userId,
          tipo: tipo as any,
          conteudo,
        });

        // Broadcast para todos na conversa
        io!.to(`conversa:${conversaId}`).emit('mensagem:nova', mensagem);

        // Log de auditoria
        const ip = (socket.handshake.address as string) || 'unknown';
        const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
        await createAuditLog({
          usuarioId: userId,
          acao: 'ENVIO_MENSAGEM',
          detalhes: JSON.stringify({ conversaId, mensagemId: mensagem.id }),
          ip,
          userAgent,
        });
      } catch (error: any) {
        socket.emit('erro', { message: error.message });
      }
    });

    // Evento: Marcar mensagens como lidas
    socket.on('mensagens:marcar-lidas', async (data: { conversaId: number }) => {
      try {
        const { conversaId } = data;

        const resultado = await chatInternoService.marcarMensagensComoLidas(conversaId, userId);

        // Notificar outros participantes
        socket.to(`conversa:${conversaId}`).emit('mensagens:lidas', {
          conversaId,
          usuarioId: userId,
          quantidade: resultado.marcadas,
        });
      } catch (error: any) {
        socket.emit('erro', { message: error.message });
      }
    });

    // Evento: Usuário está digitando
    socket.on('digitando:iniciar', async (data: { conversaId: number }) => {
      const { conversaId } = data;

      if (!usuariosDigitando.has(conversaId)) {
        usuariosDigitando.set(conversaId, new Set());
      }
      usuariosDigitando.get(conversaId)!.add(userId);

      // Notificar outros participantes
      socket.to(`conversa:${conversaId}`).emit('digitando:status', {
        conversaId,
        usuarioId: userId,
        digitando: true,
      });

      // Atualizar status no banco
      await chatInternoService.updateStatusOnline(userId, true, conversaId);
    });

    // Evento: Usuário parou de digitar
    socket.on('digitando:parar', async (data: { conversaId: number }) => {
      const { conversaId } = data;

      usuariosDigitando.get(conversaId)?.delete(userId);

      // Notificar outros participantes
      socket.to(`conversa:${conversaId}`).emit('digitando:status', {
        conversaId,
        usuarioId: userId,
        digitando: false,
      });

      // Atualizar status no banco
      await chatInternoService.updateStatusOnline(userId, true);
    });

    // Evento: Desconexão
    socket.on('disconnect', async () => {
      console.log(`[Chat Interno] Usuário ${userId} desconectado (socket: ${socket.id})`);

      // Remover das salas
      usuariosConectados.get(userId)?.delete(socket.id);
      socketToUser.delete(socket.id);

      // Se não há mais sockets para este usuário, marcar como offline
      if (!usuariosConectados.has(userId) || usuariosConectados.get(userId)!.size === 0) {
        await chatInternoService.updateStatusOnline(userId, false);
        usuariosConectados.delete(userId);

        // Notificar outros usuários
        socket.broadcast.emit('usuario:offline', { userId });
      }

      // Remover de todas as listas de digitando
      for (const [conversaId, usuarios] of usuariosDigitando.entries()) {
        usuarios.delete(userId);
        if (usuarios.size === 0) {
          usuariosDigitando.delete(conversaId);
        }
      }

      // Log de auditoria
      const ip = (socket.handshake.address as string) || 'unknown';
      const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
      await createAuditLog({
        usuarioId: userId,
        acao: 'WEBSOCKET_DISCONNECT',
        detalhes: JSON.stringify({ socketId: socket.id }),
        ip,
        userAgent,
      });
    });
  });

  console.log('✅ WebSocket do Chat Interno inicializado');
}

/**
 * Obtém a instância do Socket.IO
 */
export function getChatInternoIO(): SocketIOServer | null {
  return io;
}

/**
 * Envia uma notificação para uma conversa específica
 */
export function notifyConversa(conversaId: number, event: string, data: any) {
  if (io) {
    io.to(`conversa:${conversaId}`).emit(event, data);
  }
}

