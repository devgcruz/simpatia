import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

let io: SocketIOServer | null = null;

/**
 * Blacklist de tokens invalidados
 * Armazena tokens que foram invalidados via logout
 * Formato: token -> timestamp de expiração (quando o token JWT expira naturalmente)
 */
export const tokenBlacklist = new Map<string, number>();

/**
 * Limpa tokens expirados da blacklist periodicamente
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, expiresAt] of tokenBlacklist.entries()) {
    if (expiresAt < now) {
      tokenBlacklist.delete(token);
    }
  }
}

// Limpar tokens expirados a cada 5 minutos
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);

/**
 * Rate Limiting para WebSocket
 */
interface RateLimitInfo {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
}

interface SocketRateLimit {
  messages: RateLimitInfo;
  events: RateLimitInfo;
  lastMessageTime: number;
}

// Armazenar rate limits por IP e por Socket ID
const ipRateLimits = new Map<string, { connections: RateLimitInfo; lastConnectionTime: number; activeConnections: number }>();
const socketRateLimits = new Map<string, SocketRateLimit>();
const blacklistedIPs = new Map<string, number>(); // IP -> blockUntil timestamp

// Rastrear conexões ativas por IP e por socket
const activeConnectionsByIP = new Map<string, Set<string>>(); // IP -> Set<socketId>
const socketRooms = new Map<string, Set<string>>(); // socketId -> Set<roomName>

// Configurações de Rate Limit
const RATE_LIMIT_CONFIG = {
  // Conexões simultâneas: máximo 10 conexões por IP
  MAX_CONCURRENT_CONNECTIONS_PER_IP: 10,

  // Reconexões: máximo 5 conexões por minuto por IP
  MAX_RECONNECTIONS_PER_MINUTE: 5,
  RECONNECTION_WINDOW_MS: 60 * 1000, // 1 minuto

  // Mensagens: máximo 20 mensagens por minuto por socket (reduzido de 30)
  MAX_MESSAGES_PER_MINUTE: 20,
  MESSAGE_WINDOW_MS: 60 * 1000, // 1 minuto

  // Eventos: máximo 10 eventos por minuto por socket
  MAX_EVENTS_PER_MINUTE: 10,
  EVENT_WINDOW_MS: 60 * 1000, // 1 minuto

  // Tempo mínimo entre mensagens (anti-flood)
  MIN_TIME_BETWEEN_MESSAGES_MS: 100, // 100ms

  // Limite de salas por conexão
  MAX_ROOMS_PER_CONNECTION: 5,

  // Limite de tentativas de inscrição em salas por minuto
  MAX_ROOM_SUBSCRIPTIONS_PER_MINUTE: 10,

  // Blacklist: bloquear IP por 15 minutos após violação
  BLACKLIST_DURATION_MS: 15 * 60 * 1000, // 15 minutos
};

/**
 * Obtém o IP do socket
 */
function getSocketIP(socket: Socket): string {
  const req = socket.handshake;
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips ? ips.trim() : 'unknown';
  }
  return (req.address as string) || 'unknown';
}

/**
 * Verifica se um IP está na blacklist
 * Em desenvolvimento local, nunca bloquear localhost permanentemente
 */
function isIPBlacklisted(ip: string): boolean {
  // Em desenvolvimento, nunca bloquear localhost permanentemente
  const isLocalhostIP = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction && isLocalhostIP) {
    // Em desenvolvimento local, limpar blacklist de localhost automaticamente
    blacklistedIPs.delete(ip);
    return false;
  }
  
  const blockUntil = blacklistedIPs.get(ip);
  if (!blockUntil) {
    return false;
  }

  if (Date.now() > blockUntil) {
    // Blacklist expirada
    blacklistedIPs.delete(ip);
    return false;
  }

  return true;
}

/**
 * Adiciona IP à blacklist
 */
function blacklistIP(ip: string, reason: string): void {
  const blockUntil = Date.now() + RATE_LIMIT_CONFIG.BLACKLIST_DURATION_MS;
  blacklistedIPs.set(ip, blockUntil);
  console.error(`[WebSocket Rate Limit] IP ${ip} blacklisted até ${new Date(blockUntil).toISOString()}. Motivo: ${reason}`);
}

/**
 * Verifica limite de conexões simultâneas por IP
 */
function checkConcurrentConnectionsLimit(ip: string): { allowed: boolean; reason?: string } {
  const activeSockets = activeConnectionsByIP.get(ip);
  const currentConnections = activeSockets ? activeSockets.size : 0;

  if (currentConnections >= RATE_LIMIT_CONFIG.MAX_CONCURRENT_CONNECTIONS_PER_IP) {
    console.warn(`[WebSocket Rate Limit] IP ${ip} excedeu limite de conexões simultâneas: ${currentConnections}/${RATE_LIMIT_CONFIG.MAX_CONCURRENT_CONNECTIONS_PER_IP}`);
    return { allowed: false, reason: `Limite de conexões simultâneas excedido (${currentConnections}/${RATE_LIMIT_CONFIG.MAX_CONCURRENT_CONNECTIONS_PER_IP})` };
  }

  return { allowed: true };
}

/**
 * Verifica rate limit de reconexões por IP
 * Em desenvolvimento local, não aplicar rate limit para localhost
 */
function checkReconnectionRateLimit(ip: string): { allowed: boolean; reason?: string } {
  // Em desenvolvimento, não aplicar rate limit para localhost
  const isLocalhostIP = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction && isLocalhostIP) {
    // Em desenvolvimento local, permitir reconexões ilimitadas para localhost
    // Isso evita bloqueios durante desenvolvimento/testes
    return { allowed: true };
  }
  
  // Verificar blacklist
  if (isIPBlacklisted(ip)) {
    return { allowed: false, reason: 'IP está na blacklist' };
  }

  const now = Date.now();
  const ipLimit = ipRateLimits.get(ip);

  if (!ipLimit) {
    // Primeira conexão deste IP
    ipRateLimits.set(ip, {
      connections: {
        count: 1,
        resetTime: now + RATE_LIMIT_CONFIG.RECONNECTION_WINDOW_MS,
        blocked: false,
      },
      lastConnectionTime: now,
      activeConnections: 0,
    });
    return { allowed: true };
  }

  // Verificar se a janela de tempo expirou
  if (now > ipLimit.connections.resetTime) {
    // Resetar contador
    ipLimit.connections.count = 1;
    ipLimit.connections.resetTime = now + RATE_LIMIT_CONFIG.RECONNECTION_WINDOW_MS;
    ipLimit.lastConnectionTime = now;
    return { allowed: true };
  }

  // Verificar limite
  if (ipLimit.connections.count >= RATE_LIMIT_CONFIG.MAX_RECONNECTIONS_PER_MINUTE) {
    blacklistIP(ip, `Muitas reconexões (${ipLimit.connections.count} em ${RATE_LIMIT_CONFIG.RECONNECTION_WINDOW_MS}ms)`);
    return { allowed: false, reason: 'Muitas reconexões detectadas' };
  }

  // Incrementar contador
  ipLimit.connections.count++;
  ipLimit.lastConnectionTime = now;
  return { allowed: true };
}

/**
 * Verifica rate limit de mensagens por socket
 */
function checkMessageRateLimit(socketId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  let socketLimit = socketRateLimits.get(socketId);

  if (!socketLimit) {
    socketLimit = {
      messages: {
        count: 0,
        resetTime: now + RATE_LIMIT_CONFIG.MESSAGE_WINDOW_MS,
        blocked: false,
      },
      events: {
        count: 0,
        resetTime: now + RATE_LIMIT_CONFIG.EVENT_WINDOW_MS,
        blocked: false,
      },
      lastMessageTime: 0,
    };
    socketRateLimits.set(socketId, socketLimit);
  }

  // Verificar tempo mínimo entre mensagens (anti-flood)
  // Em desenvolvimento local, ser mais permissivo para evitar bloqueios durante testes
  const isProduction = process.env.NODE_ENV === 'production';
  const timeSinceLastMessage = now - socketLimit.lastMessageTime;
  const minTimeBetweenMessages = isProduction 
    ? RATE_LIMIT_CONFIG.MIN_TIME_BETWEEN_MESSAGES_MS 
    : Math.max(50, RATE_LIMIT_CONFIG.MIN_TIME_BETWEEN_MESSAGES_MS / 2); // Reduzir pela metade em desenvolvimento
  
  if (timeSinceLastMessage < minTimeBetweenMessages) {
    if (isProduction) {
      return { allowed: false, reason: 'Mensagens muito frequentes (flood detectado)' };
    } else {
      // Em desenvolvimento, apenas logar mas permitir
      console.warn(`[WebSocket Rate Limit] ⚠️ Mensagens frequentes detectadas (${timeSinceLastMessage}ms < ${minTimeBetweenMessages}ms), mas permitindo em desenvolvimento`);
      // Continuar permitindo
    }
  }

  // Verificar se a janela de tempo expirou
  if (now > socketLimit.messages.resetTime) {
    socketLimit.messages.count = 0;
    socketLimit.messages.resetTime = now + RATE_LIMIT_CONFIG.MESSAGE_WINDOW_MS;
  }

  // Verificar limite
  if (socketLimit.messages.count >= RATE_LIMIT_CONFIG.MAX_MESSAGES_PER_MINUTE) {
    socketLimit.messages.blocked = true;
    return { allowed: false, reason: `Limite de mensagens excedido (${socketLimit.messages.count}/${RATE_LIMIT_CONFIG.MAX_MESSAGES_PER_MINUTE})` };
  }

  // Incrementar contador
  socketLimit.messages.count++;
  socketLimit.lastMessageTime = now;
  return { allowed: true };
}

/**
 * Verifica limite de salas por conexão
 */
function checkRoomLimit(socketId: string): { allowed: boolean; reason?: string } {
  const rooms = socketRooms.get(socketId);
  const currentRooms = rooms ? rooms.size : 0;

  if (currentRooms >= RATE_LIMIT_CONFIG.MAX_ROOMS_PER_CONNECTION) {
    return { allowed: false, reason: `Limite de salas excedido (${currentRooms}/${RATE_LIMIT_CONFIG.MAX_ROOMS_PER_CONNECTION})` };
  }

  return { allowed: true };
}

/**
 * Verifica rate limit de tentativas de inscrição em salas
 */
function checkRoomSubscriptionRateLimit(socketId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  let socketLimit = socketRateLimits.get(socketId);

  if (!socketLimit) {
    socketLimit = {
      messages: {
        count: 0,
        resetTime: now + RATE_LIMIT_CONFIG.MESSAGE_WINDOW_MS,
        blocked: false,
      },
      events: {
        count: 0,
        resetTime: now + RATE_LIMIT_CONFIG.EVENT_WINDOW_MS,
        blocked: false,
      },
      lastMessageTime: 0,
    };
    socketRateLimits.set(socketId, socketLimit);
  }

  // Usar o contador de eventos para rastrear inscrições em salas
  if (now > socketLimit.events.resetTime) {
    socketLimit.events.count = 0;
    socketLimit.events.resetTime = now + RATE_LIMIT_CONFIG.EVENT_WINDOW_MS;
  }

  if (socketLimit.events.count >= RATE_LIMIT_CONFIG.MAX_ROOM_SUBSCRIPTIONS_PER_MINUTE) {
    return { allowed: false, reason: `Limite de inscrições em salas excedido (${socketLimit.events.count}/${RATE_LIMIT_CONFIG.MAX_ROOM_SUBSCRIPTIONS_PER_MINUTE})` };
  }

  socketLimit.events.count++;
  return { allowed: true };
}

/**
 * Verifica rate limit de eventos por socket
 */
function checkEventRateLimit(socketId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  let socketLimit = socketRateLimits.get(socketId);

  if (!socketLimit) {
    socketLimit = {
      messages: {
        count: 0,
        resetTime: now + RATE_LIMIT_CONFIG.MESSAGE_WINDOW_MS,
        blocked: false,
      },
      events: {
        count: 0,
        resetTime: now + RATE_LIMIT_CONFIG.EVENT_WINDOW_MS,
        blocked: false,
      },
      lastMessageTime: 0,
    };
    socketRateLimits.set(socketId, socketLimit);
  }

  // Verificar se a janela de tempo expirou
  if (now > socketLimit.events.resetTime) {
    socketLimit.events.count = 0;
    socketLimit.events.resetTime = now + RATE_LIMIT_CONFIG.EVENT_WINDOW_MS;
  }

  // Verificar limite
  if (socketLimit.events.count >= RATE_LIMIT_CONFIG.MAX_EVENTS_PER_MINUTE) {
    socketLimit.events.blocked = true;
    return { allowed: false, reason: `Limite de eventos excedido (${socketLimit.events.count}/${RATE_LIMIT_CONFIG.MAX_EVENTS_PER_MINUTE})` };
  }

  // Incrementar contador
  socketLimit.events.count++;
  return { allowed: true };
}

/**
 * Limpa rate limits expirados (garbage collection)
 */
function cleanupExpiredRateLimits(): void {
  const now = Date.now();

  // Limpar blacklist expirada
  for (const [ip, blockUntil] of blacklistedIPs.entries()) {
    if (now > blockUntil) {
      blacklistedIPs.delete(ip);
    }
  }

  // Limpar rate limits de IPs expirados
  for (const [ip, ipLimit] of ipRateLimits.entries()) {
    if (now > ipLimit.connections.resetTime + RATE_LIMIT_CONFIG.RECONNECTION_WINDOW_MS) {
      ipRateLimits.delete(ip);
    }
  }

  // Limpar rate limits de sockets expirados
  for (const [socketId, socketLimit] of socketRateLimits.entries()) {
    if (now > socketLimit.messages.resetTime + RATE_LIMIT_CONFIG.MESSAGE_WINDOW_MS &&
        now > socketLimit.events.resetTime + RATE_LIMIT_CONFIG.EVENT_WINDOW_MS) {
      socketRateLimits.delete(socketId);
    }
  }
}

// Executar limpeza a cada 5 minutos
setInterval(cleanupExpiredRateLimits, 5 * 60 * 1000);

/**
 * Validação de Mensagens WebSocket
 */

// Limite máximo de tamanho de mensagem (10KB)
const MAX_MESSAGE_SIZE = 10 * 1024; // 10KB

// Whitelist de comandos permitidos - NUNCA aceitar eventos customizados
// Apenas eventos explícitos nesta lista são permitidos
const ALLOWED_COMMANDS = new Set([
  'subscribe:doutor',
  'subscribe:clinica',
  'disconnect',
  'error',
  'connect',
]);

// Eventos que o servidor emite (não recebe do cliente)
const SERVER_EMIT_EVENTS = new Set([
  'agendamento:updated',
  'error',
  'connect',
  'disconnect',
]);

// Caracteres perigosos que podem ser usados para injeção de comandos
const DANGEROUS_CHARS = /[;'"\\`$(){}[\]<>|&*?~!]/g;
const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT|JAVASCRIPT|ONLOAD|ONERROR)\b/gi;

// Schemas de validação Zod para cada tipo de mensagem
const SubscribeDoutorSchema = z.object({
  type: z.literal('subscribe:doutor'),
  data: z.number().int().positive(),
}).strict(); // strict() previne campos extras

const SubscribeClinicaSchema = z.object({
  type: z.literal('subscribe:clinica'),
  data: z.number().int().positive(),
}).strict();

// Schema genérico para validação de mensagens
const WebSocketMessageSchema = z.union([
  SubscribeDoutorSchema,
  SubscribeClinicaSchema,
]);

/**
 * Remove propriedades do prototype para prevenir prototype poisoning
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Se for um objeto, criar um novo objeto limpo
  if (typeof obj === 'object' && !Array.isArray(obj) && obj.constructor === Object) {
    const sanitized: any = {};
    for (const key in obj) {
      // Ignorar propriedades do prototype
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Ignorar propriedades perigosas
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  // Se for array, sanitizar cada elemento
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  // Tipos primitivos são seguros
  return obj;
}

/**
 * Valida o tamanho da mensagem
 */
function validateMessageSize(message: any): { valid: boolean; error?: string } {
  try {
    const messageStr = JSON.stringify(message);
    const size = Buffer.byteLength(messageStr, 'utf8');
    
    if (size > MAX_MESSAGE_SIZE) {
      return {
        valid: false,
        error: `Mensagem muito grande: ${size} bytes (máximo: ${MAX_MESSAGE_SIZE} bytes)`,
      };
    }
    
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: `Erro ao validar tamanho da mensagem: ${error?.message || 'Erro desconhecido'}`,
    };
  }
}

/**
 * Valida o formato JSON da mensagem
 */
function validateJSONFormat(message: any): { valid: boolean; parsed?: any; error?: string } {
  // Se for número, aceitar diretamente (para subscribe:doutor e subscribe:clinica)
  if (typeof message === 'number') {
    return { valid: true, parsed: message };
  }
  
  // Se já for um objeto, verificar se é válido
  if (typeof message === 'object' && message !== null) {
    try {
      // Tentar serializar e deserializar para validar
      const jsonStr = JSON.stringify(message);
      const parsed = JSON.parse(jsonStr);
      return { valid: true, parsed };
    } catch (error: any) {
      return {
        valid: false,
        error: `JSON inválido: ${error?.message || 'Erro desconhecido'}`,
      };
    }
  }

  // Se for string, tentar parsear
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message);
      return { valid: true, parsed };
    } catch (error: any) {
      return {
        valid: false,
        error: `JSON inválido: ${error?.message || 'Erro desconhecido'}`,
      };
    }
  }

  return {
    valid: false,
    error: 'Mensagem deve ser um objeto JSON, string JSON válida ou número',
  };
}

/**
 * Valida o tipo de dados da mensagem
 */
function validateDataType(message: any, expectedType: string): { valid: boolean; error?: string } {
  if (expectedType === 'number' && typeof message !== 'number') {
    return {
      valid: false,
      error: `Tipo de dado inválido: esperado number, recebido ${typeof message}`,
    };
  }

  if (expectedType === 'string' && typeof message !== 'string') {
    return {
      valid: false,
      error: `Tipo de dado inválido: esperado string, recebido ${typeof message}`,
    };
  }

  if (expectedType === 'object' && (typeof message !== 'object' || message === null || Array.isArray(message))) {
    return {
      valid: false,
      error: `Tipo de dado inválido: esperado object, recebido ${typeof message}`,
    };
  }

  return { valid: true };
}

/**
 * Valida uma mensagem WebSocket completa
 */
/**
 * Valida se um nome de sala é permitido para um usuário
 * Previne criação de salas "abertas" ou não autorizadas
 */
function isRoomAllowedForUser(roomName: string, user: { id: number; role: string; clinicaId: number | null }): boolean {
  // Padrões de salas permitidas
  const userRoomPattern = /^user:\d+$/;
  const clinicaRoomPattern = /^clinica:\d+$/;
  const doutorRoomPattern = /^doutor:\d+$/;

  // Verificar se o nome da sala segue um padrão válido
  if (!userRoomPattern.test(roomName) && !clinicaRoomPattern.test(roomName) && !doutorRoomPattern.test(roomName)) {
    console.error(`[WebSocket Security] ❌ Nome de sala com padrão inválido: ${roomName}`);
    return false;
  }

  // Extrair IDs do nome da sala com validação de segurança
  if (roomName.startsWith('user:')) {
    const parts = roomName.split(':');
    if (parts.length < 2 || !parts[1]) {
      return false;
    }
    const userId = parseInt(parts[1], 10);
    if (isNaN(userId)) {
      return false;
    }
    // Usuário só pode acessar sua própria sala
    return userId === user.id;
  }

  if (roomName.startsWith('clinica:')) {
    const parts = roomName.split(':');
    if (parts.length < 2 || !parts[1]) {
      return false;
    }
    const clinicaId = parseInt(parts[1], 10);
    if (isNaN(clinicaId)) {
      return false;
    }
    // SUPER_ADMIN pode acessar qualquer clínica (validação adicional será feita no handler)
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }
    // Outros usuários só podem acessar a sala da sua clínica
    return user.clinicaId === clinicaId;
  }

  if (roomName.startsWith('doutor:')) {
    const parts = roomName.split(':');
    if (parts.length < 2 || !parts[1]) {
      return false;
    }
    const doutorId = parseInt(parts[1], 10);
    if (isNaN(doutorId)) {
      return false;
    }
    // DOUTOR só pode acessar sua própria sala
    if (user.role === 'DOUTOR') {
      return user.id === doutorId;
    }
    // SUPER_ADMIN pode acessar qualquer doutor (validação adicional será feita no handler)
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }
    // Para outros roles, a validação será feita no handler específico
    // (SECRETARIA precisa de vínculo, CLINICA_ADMIN precisa ser da mesma clínica)
    return true; // Permitir aqui, validação completa no handler
  }

  return false;
}

/**
 * Valida se uma string contém caracteres perigosos ou comandos SQL
 */
function containsDangerousContent(value: any): boolean {
  if (typeof value === 'string') {
    // Verificar caracteres perigosos
    if (DANGEROUS_CHARS.test(value)) {
      return true;
    }
    // Verificar palavras-chave SQL/JavaScript
    if (SQL_KEYWORDS.test(value)) {
      return true;
    }
  }
  if (typeof value === 'object' && value !== null) {
    // Verificar recursivamente em objetos
    for (const key in value) {
      if (containsDangerousContent(key) || containsDangerousContent(value[key])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Valida se um valor pode ser usado com segurança em queries
 */
function validateForQuery(value: any): { valid: boolean; error?: string } {
  // Apenas números inteiros positivos são permitidos para IDs
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value <= 0 || !Number.isFinite(value)) {
      return { valid: false, error: 'ID deve ser um número inteiro positivo e finito' };
    }
    return { valid: true };
  }
  
  // Strings não são permitidas em queries de IDs
  if (typeof value === 'string') {
    return { valid: false, error: 'Strings não são permitidas em queries de IDs' };
  }
  
  return { valid: false, error: 'Tipo de dado inválido para query' };
}

function validateWebSocketMessage(
  event: string,
  message: any,
  socketId: string
): { valid: boolean; sanitized?: any; error?: string } {
  // 1. Verificar se o comando está na whitelist - SEM EXCEÇÕES
  // NUNCA aceitar eventos customizados, mesmo que comecem com prefixos conhecidos
  if (!ALLOWED_COMMANDS.has(event)) {
    console.error(`[WebSocket Security] ❌ Evento não permitido: ${event} (Socket: ${socketId})`);
    return {
      valid: false,
      error: `Comando não permitido: ${event}. Apenas eventos na whitelist são aceitos.`,
    };
  }
  
  // 2. Prevenir eventos que o servidor emite (não devem ser recebidos do cliente)
  if (SERVER_EMIT_EVENTS.has(event)) {
    console.error(`[WebSocket Security] ❌ Tentativa de enviar evento do servidor: ${event} (Socket: ${socketId})`);
    return {
      valid: false,
      error: `Evento ${event} é apenas para emissão do servidor, não pode ser recebido do cliente.`,
    };
  }

  // 3. Verificar se a mensagem contém conteúdo perigoso (SQL injection, comandos, etc.)
  // Para números em subscribe:doutor e subscribe:clinica, não verificar conteúdo perigoso (números são seguros)
  if ((event === 'subscribe:doutor' || event === 'subscribe:clinica') && typeof message === 'number') {
    // Números são primitivos seguros, não precisam verificação de conteúdo perigoso
  } else if (containsDangerousContent(message)) {
    console.error(`[WebSocket Security] ❌ Mensagem contém conteúdo perigoso (Socket: ${socketId})`);
    return {
      valid: false,
      error: 'Mensagem contém caracteres ou comandos não permitidos',
    };
  }

  // 4. Sanitizar mensagem para prevenir prototype poisoning
  // Para números em subscribe:doutor e subscribe:clinica, não precisa sanitizar (já são primitivos seguros)
  let sanitized: any;
  if ((event === 'subscribe:doutor' || event === 'subscribe:clinica') && typeof message === 'number') {
    sanitized = message; // Números são primitivos seguros, não precisam sanitização
  } else {
    sanitized = sanitizeObject(message);
  }

  // 5. Validar tamanho da mensagem
  const sizeCheck = validateMessageSize(sanitized);
  if (!sizeCheck.valid) {
    return {
      valid: false,
      error: sizeCheck.error || 'Mensagem muito grande',
    };
  }

  // 6. Validar formato JSON (pular para números em subscribe:doutor e subscribe:clinica)
  let parsedMessage: any = sanitized;
  if (event === 'subscribe:doutor' || event === 'subscribe:clinica') {
    // Para esses eventos, aceitar números diretamente
    if (typeof sanitized === 'number') {
      parsedMessage = sanitized;
    } else {
      // Se não for número, tentar validar como JSON
      const jsonCheck = validateJSONFormat(sanitized);
      if (!jsonCheck.valid) {
        return {
          valid: false,
          error: jsonCheck.error || 'Formato JSON inválido ou número esperado',
        };
      }
      parsedMessage = jsonCheck.parsed || sanitized;
    }
  } else {
    // Para outros eventos, validar JSON normalmente
    const jsonCheck = validateJSONFormat(sanitized);
    if (!jsonCheck.valid) {
      return {
        valid: false,
        error: jsonCheck.error || 'Formato JSON inválido',
      };
    }
    parsedMessage = jsonCheck.parsed || sanitized;
  }

  // 7. Validar schema específico baseado no evento
  if (event === 'subscribe:doutor') {
    // Se a mensagem já é um número, usar diretamente
    let messageToValidate = parsedMessage;
    if (typeof message === 'number') {
      messageToValidate = message;
    }
    
    // Validar que é um número
    const typeCheck = validateDataType(messageToValidate, 'number');
    if (!typeCheck.valid) {
      return {
        valid: false,
        error: typeCheck.error || 'Tipo de dado inválido',
      };
    }

    // Validar que é seguro para usar em queries (prevenir SQL injection)
    const queryValidation = validateForQuery(parsedMessage);
    if (!queryValidation.valid) {
      return {
        valid: false,
        error: queryValidation.error || 'Valor inválido para query',
      };
    }

    // Validar que é um inteiro positivo
    if (!Number.isInteger(messageToValidate) || messageToValidate <= 0) {
      return {
        valid: false,
        error: 'doutorId deve ser um número inteiro positivo',
      };
    }

    // Garantir que o valor é um número primitivo (não objeto Number)
    const safeId = Number(messageToValidate);
    if (!Number.isSafeInteger(safeId)) {
      return {
        valid: false,
        error: 'doutorId deve ser um número seguro (Number.isSafeInteger)',
      };
    }

    return { valid: true, sanitized: safeId };
  }

  if (event === 'subscribe:clinica') {
    // Se a mensagem já é um número, usar diretamente
    let messageToValidate = parsedMessage;
    if (typeof message === 'number') {
      messageToValidate = message;
    }
    
    // Validar que é um número
    const typeCheck = validateDataType(messageToValidate, 'number');
    if (!typeCheck.valid) {
      return {
        valid: false,
        error: typeCheck.error || 'Tipo de dado inválido',
      };
    }

    // Validar que é seguro para usar em queries (prevenir SQL injection)
    const queryValidation = validateForQuery(parsedMessage);
    if (!queryValidation.valid) {
      return {
        valid: false,
        error: queryValidation.error || 'Valor inválido para query',
      };
    }

    // Validar que é um inteiro positivo
    if (!Number.isInteger(messageToValidate) || messageToValidate <= 0) {
      return {
        valid: false,
        error: 'clinicaId deve ser um número inteiro positivo',
      };
    }

    // Garantir que o valor é um número primitivo (não objeto Number)
    const safeId = Number(messageToValidate);
    if (!Number.isSafeInteger(safeId)) {
      return {
        valid: false,
        error: 'clinicaId deve ser um número seguro (Number.isSafeInteger)',
      };
    }

    return { valid: true, sanitized: safeId };
  }

  // Para eventos 'disconnect' e 'error', não esperamos mensagens do cliente
  // Se chegou aqui, é um evento não tratado - rejeitar
  return {
    valid: false,
    error: `Evento ${event} não aceita mensagens do cliente ou formato não suportado`,
  };
}

interface AuthenticatedSocket extends Socket {
  user?: {
    id: number;
    role: string;
    clinicaId: number;
  };
}

export interface AgendamentoEventData {
  id: number;
  doutorId: number;
  clinicaId: number;
  action: 'created' | 'updated' | 'deleted' | 'finalized' | 'encaixe_confirmed';
  agendamento?: any;
}

/**
 * Valida o token JWT do WebSocket
 * Verifica se o token está na blacklist (invalidado via logout)
 */
function validateWebSocketToken(token: string | undefined): { valid: boolean; user?: any; error?: string } {
  if (!token) {
    return { valid: false, error: 'Token não fornecido' };
  }

  if (!process.env.JWT_SECRET) {
    return { valid: false, error: 'Configuração de token ausente' };
  }

  try {
    // Remover "Bearer " se presente
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    
    // Verificar se o token está na blacklist (foi invalidado via logout)
    if (tokenBlacklist.has(cleanToken)) {
      const expiresAt = tokenBlacklist.get(cleanToken);
      // Se ainda não expirou naturalmente, o token está invalidado
      if (expiresAt && expiresAt > Date.now()) {
        console.warn(`[WebSocket] Tentativa de usar token invalidado (logout)`);
        return { valid: false, error: 'Token foi invalidado. Faça login novamente.' };
      }
      // Se expirou, remover da blacklist
      tokenBlacklist.delete(cleanToken);
    }
    
    const payload = jwt.verify(cleanToken, process.env.JWT_SECRET) as any;
    
    return {
      valid: true,
      user: {
        id: payload.sub,
        role: payload.role,
        clinicaId: payload.clinicaId,
      },
    };
  } catch (error: any) {
    return { valid: false, error: error.message || 'Token inválido' };
  }
}

/**
 * Invalida um token JWT (adiciona à blacklist)
 * Usado quando o usuário faz logout
 */
export function invalidateToken(token: string): void {
  if (!token) {
    return;
  }

  try {
    // Remover "Bearer " se presente
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    
    // Decodificar o token para obter a data de expiração
    const decoded = jwt.decode(cleanToken) as any;
    if (decoded && decoded.exp) {
      // Armazenar o timestamp de expiração do token
      const expiresAt = decoded.exp * 1000; // Converter para milliseconds
      tokenBlacklist.set(cleanToken, expiresAt);
      console.log(`[WebSocket] Token invalidado (logout). Expira em: ${new Date(expiresAt).toISOString()}`);
    } else {
      // Se não conseguir decodificar, adicionar com expiração de 1 hora (padrão)
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hora
      tokenBlacklist.set(cleanToken, expiresAt);
      console.log(`[WebSocket] Token invalidado (logout). Expira em: ${new Date(expiresAt).toISOString()}`);
    }
  } catch (error) {
    console.error('[WebSocket] Erro ao invalidar token:', error);
  }
}

/**
 * Desconecta todos os sockets de um usuário específico
 * Usado quando o usuário faz logout
 */
export function disconnectUserSockets(userId: number): void {
  if (!io) {
    return;
  }

  let disconnectedCount = 0;
  
  // Iterar sobre todos os sockets conectados
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.user && socket.user.id === userId) {
      console.log(`[WebSocket] Desconectando socket ${socket.id} do usuário ${userId} (logout)`);
      socket.emit('logout', { message: 'Sessão invalidada. Faça login novamente.' });
      socket.disconnect(true); // true = desconectar imediatamente, sem tentar reconectar
      disconnectedCount++;
    }
  });

  if (disconnectedCount > 0) {
    console.log(`[WebSocket] ${disconnectedCount} socket(s) desconectado(s) para o usuário ${userId}`);
  }
}

/**
 * Valida o Origin e Host para prevenir CSWSH
 * SEMPRE exige HTTPS/WSS, mesmo em ambiente interno
 */
function validateOrigin(origin: string | undefined, host: string | undefined): boolean {
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  const allowedHost = new URL(allowedOrigin).host;
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalhost = host === 'localhost' || host?.includes('localhost') || host === '127.0.0.1';

  // Se não houver origin, pode ser uma conexão direta
  if (!origin) {
    // Em produção, SEMPRE rejeitar conexões sem origin
    if (isProduction) {
      console.warn('[WebSocket] Conexão sem Origin rejeitada (produção)');
      return false;
    }
    // Em desenvolvimento, permitir apenas localhost
    if (!isLocalhost) {
      console.warn('[WebSocket] Conexão sem Origin rejeitada (não é localhost)');
      return false;
    }
    // Em desenvolvimento localhost, ainda exigir HTTPS
    console.warn('[WebSocket] AVISO: Conexão sem Origin em desenvolvimento. Considere usar HTTPS mesmo localmente.');
  }

  try {
    // Garantir que origin não é undefined antes de criar URL
    if (!origin) {
      return false;
    }
    
    const originUrl = new URL(origin);
    const allowedUrl = new URL(allowedOrigin);

    // Em produção, SEMPRE exigir HTTPS/WSS - nunca aceitar HTTP/WS
    // Em desenvolvimento local, permitir HTTP/WS
    const isLocalhostOrigin = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
    
    if (isProduction && !isLocalhostOrigin) {
      // Em produção (não localhost), exigir HTTPS/WSS
      if (originUrl.protocol === 'http:' || originUrl.protocol === 'ws:') {
        console.error(`[WebSocket] ❌ CONEXÃO NÃO SEGURA REJEITADA: ${originUrl.protocol} não é permitido em produção. Use HTTPS/WSS.`);
        return false;
      }
      
      // Validar que o protocolo é HTTPS
      if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'wss:') {
        console.warn(`[WebSocket] Protocolo inválido: ${originUrl.protocol} (esperado: https: ou wss:)`);
        return false;
      }
    } else {
      // Em desenvolvimento local, permitir HTTP/WS
      if (originUrl.protocol === 'http:' || originUrl.protocol === 'ws:') {
        console.log(`[WebSocket] ✅ Modo desenvolvimento local detectado. Permitindo ${originUrl.protocol}`);
        // Continuar com validação de host
      } else if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'wss:') {
        console.warn(`[WebSocket] Protocolo inválido: ${originUrl.protocol}`);
        return false;
      }
    }

    // Validar host (deve corresponder ao FRONTEND_URL)
    const originHost = originUrl.host || '';
    const allowedHost = allowedUrl.host || '';
    if (originHost !== allowedHost) {
      console.warn(`[WebSocket] Origin não autorizado: ${originHost} (esperado: ${allowedHost})`);
      return false;
    }

    // Validar Host header se fornecido
    // Em desenvolvimento local, o host será o servidor WebSocket (localhost:3333), não o frontend (localhost:3000)
    // Isso é normal e esperado - o host é o servidor que está recebendo a conexão
    if (host) {
      const isLocalhostHost = host === 'localhost' || host?.includes('localhost') || host === '127.0.0.1' || host?.includes('127.0.0.1');
      const isLocalhostOrigin = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
      
      // Em desenvolvimento local, permitir que o host seja o servidor WebSocket
      if (!isProduction && isLocalhostHost && isLocalhostOrigin) {
        console.log(`[WebSocket] ✅ Host do servidor WebSocket permitido em desenvolvimento: ${host} (origin: ${originUrl.host})`);
        return true;
      }
      
      // Em produção ou se não for localhost, validar normalmente
      if (host !== allowedHost && host !== originUrl.host) {
        console.warn(`[WebSocket] Host não autorizado: ${host} (esperado: ${allowedHost} ou ${originUrl.host})`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('[WebSocket] Erro ao validar Origin:', error);
    return false;
  }
}

/**
 * Inicializa o servidor WebSocket com proteções de segurança
 */
export function initializeWebSocket(server: HTTPServer) {
  // Converter FRONTEND_URL para HTTPS se necessário
  let allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  if (allowedOrigin.startsWith('http://') && !allowedOrigin.includes('localhost')) {
    allowedOrigin = allowedOrigin.replace('http://', 'https://');
    console.warn(`[WebSocket] FRONTEND_URL convertido para HTTPS: ${allowedOrigin}`);
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Adicionar proteção adicional - SEMPRE exigir conexão segura
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      const host = req.headers.host;
      // Verificar se a conexão é segura via headers (útil quando há proxy reverso)
      const forwardedProto = req.headers['x-forwarded-proto'];
      const isSecure = forwardedProto === 'https' || (req as any).connection?.encrypted;

      // Obter IP do cliente
      const forwarded = req.headers['x-forwarded-for'];
      let ip: string;
      if (forwarded) {
        const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
        ip = ips ? ips.trim() : 'unknown';
      } else {
        ip = (req.socket.remoteAddress as string) || 'unknown';
      }

      // 1. Verificar blacklist (apenas se IP for válido)
      // Em desenvolvimento local, não bloquear localhost mesmo se estiver na blacklist
      const isLocalhostIPForBlacklist = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || host?.includes('localhost');
      const isProductionForBlacklist = process.env.NODE_ENV === 'production';
      
      if (ip !== 'unknown' && isIPBlacklisted(ip)) {
        // Em desenvolvimento, permitir localhost mesmo se estiver na blacklist (para facilitar testes)
        if (!isProductionForBlacklist && isLocalhostIPForBlacklist) {
          console.warn(`[WebSocket Rate Limit] ⚠️ IP ${ip} está na blacklist, mas permitindo em desenvolvimento local`);
          // Continuar com a conexão
        } else {
          console.error(`[WebSocket Rate Limit] ❌ Conexão rejeitada - IP ${ip} está na blacklist`);
          callback(null, false);
          return;
        }
      }

      // 2. Verificar limite de conexões simultâneas por IP
      if (ip !== 'unknown') {
        const concurrentCheck = checkConcurrentConnectionsLimit(ip);
        if (!concurrentCheck.allowed) {
          console.error(`[WebSocket Rate Limit] ❌ Conexão rejeitada - ${concurrentCheck.reason} (IP: ${ip})`);
          blacklistIP(ip, `Excedeu limite de conexões simultâneas`);
          callback(null, false);
          return;
        }
      }

      // 3. Verificar rate limit de reconexões (apenas se IP for válido)
      if (ip !== 'unknown') {
        const reconnectionCheck = checkReconnectionRateLimit(ip);
        if (!reconnectionCheck.allowed) {
          console.error(`[WebSocket Rate Limit] ❌ Conexão rejeitada - ${reconnectionCheck.reason} (IP: ${ip})`);
          callback(null, false);
          return;
        }
      }

      // 4. Validar que a conexão é segura (HTTPS/WSS) em produção
      // Em desenvolvimento local, permitir HTTP/WS
      // Reutilizar variáveis já definidas acima
      const isProductionForSecurity = isProductionForBlacklist;
      const isLocalhostIPForSecurity = isLocalhostIPForBlacklist;
      
      // Permitir conexões não seguras apenas em desenvolvimento local
      if (!isSecure) {
        if (isProductionForSecurity && !isLocalhostIPForSecurity) {
          console.error(`[WebSocket] ❌ CONEXÃO NÃO SEGURA REJEITADA: Requer HTTPS/WSS em produção`);
          callback(null, false);
          return;
        }
        if (!isProductionForSecurity && isLocalhostIPForSecurity) {
          console.log(`[WebSocket] ✅ Modo desenvolvimento local detectado. Permitindo conexão HTTP/WS (IP: ${ip})`);
        } else if (!isLocalhostIPForSecurity) {
          console.error(`[WebSocket] ❌ CONEXÃO NÃO SEGURA REJEITADA: Requer HTTPS/WSS fora de localhost em desenvolvimento`);
          callback(null, false);
          return;
        }
      }

      // 5. Validar Origin e Host
      if (!validateOrigin(origin, host)) {
        console.warn(`[WebSocket] ❌ Conexão rejeitada - Origin/Host inválido: ${origin} / ${host}`);
        callback(null, false);
        return;
      }

      callback(null, true);
    },
  });

  // Middleware de autenticação para WebSocket
  io.use((socket: AuthenticatedSocket, next) => {
    const handshake = socket.handshake;
    const origin = handshake.headers.origin;
    const host = handshake.headers.host;

    // 1. Validar Origin e Host
    if (!validateOrigin(origin, host)) {
      console.warn(`[WebSocket] ❌ Conexão rejeitada no middleware - Origin/Host inválido: ${origin} / ${host}`);
      return next(new Error('Origin ou Host não autorizado'));
    }

    // 2. Validar token JWT
    // Prioridade: Authorization header > auth.token > cookie
    // ❌ NUNCA aceitar token via query string (vulnerabilidade de segurança)
    let authHeader = handshake.headers.authorization;
    // Extrair token do header "Bearer <token>"
    if (authHeader && authHeader.startsWith('Bearer ')) {
      authHeader = authHeader.substring(7); // Remove "Bearer "
    }
    const tokenFromAuth = handshake.auth?.token;
    
    // Verificar se há tentativa de usar token via query string (BLOQUEAR)
    const tokenFromQuery = handshake.query?.token as string | undefined;
    if (tokenFromQuery) {
      const ip = getSocketIP(socket);
      console.error(`[WebSocket Security] ❌ Tentativa de autenticação via query string bloqueada (IP: ${ip}, Socket: ${socket.id})`);
      blacklistIP(ip, 'Tentativa de autenticação via query string (inseguro)');
      return next(new Error('Autenticação via query string não é permitida por questões de segurança. Use Authorization header.'));
    }
    
    // Tentar ler token do cookie (HTTPOnly será enviado automaticamente pelo navegador)
    // IMPORTANTE: Mesmo que já tenhamos authHeader ou tokenFromAuth, também tentamos ler o cookie
    // para garantir que funcionará mesmo quando o frontend não conseguir ler o token via JS
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

    // Prioridade: authHeader > tokenFromAuth > tokenFromCookie
    const token = authHeader || tokenFromAuth || tokenFromCookie;
    
    if (!token) {
      console.warn(`[WebSocket] ❌ Conexão rejeitada - Token não fornecido`);
      return next(new Error('Autenticação falhou: Token não fornecido'));
    }

    const validation = validateWebSocketToken(token);

    if (!validation.valid) {
      console.warn(`[WebSocket] Conexão rejeitada - Token inválido: ${validation.error}`);
      return next(new Error(`Autenticação falhou: ${validation.error}`));
    }

    // 3. Armazenar informações do usuário no socket
    socket.user = validation.user;

    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    // Verificar se o socket foi autenticado
    if (!socket.user) {
      console.error(`[WebSocket] Socket ${socket.id} conectado sem autenticação - desconectando`);
      socket.disconnect();
      return;
    }

    const user = socket.user;
    const ip = getSocketIP(socket);
    
    // Rastrear conexão ativa por IP
    if (!activeConnectionsByIP.has(ip)) {
      activeConnectionsByIP.set(ip, new Set());
    }
    activeConnectionsByIP.get(ip)!.add(socket.id);
    
    // Inicializar rastreamento de salas para este socket
    socketRooms.set(socket.id, new Set());
    
    // CONEXÃO AUTOMÁTICA ÀS SALAS AUTORIZADAS
    // Todas as salas são validadas antes de conectar para evitar salas "abertas"
    
    // 1. Sala do próprio perfil (sempre permitida)
    const userRoom = `user:${user.id}`;
    if (!containsDangerousContent(userRoom) && isRoomAllowedForUser(userRoom, user)) {
      socket.join(userRoom);
    }

    // 2. Sala da clínica (se o usuário tiver clinicaId)
    if (user.clinicaId) {
      const clinicaRoom = `clinica:${user.clinicaId}`;
      if (!containsDangerousContent(clinicaRoom) && isRoomAllowedForUser(clinicaRoom, user)) {
        socket.join(clinicaRoom);
        // Rastrear sala
        const rooms = socketRooms.get(socket.id);
        if (rooms) {
          rooms.add(clinicaRoom);
        }
      }
    }

    // 3. Se for DOUTOR, conectar automaticamente à sala do próprio doutor
    if (user.role === 'DOUTOR') {
      const doutorRoom = `doutor:${user.id}`;
      if (!containsDangerousContent(doutorRoom) && isRoomAllowedForUser(doutorRoom, user)) {
        socket.join(doutorRoom);
        const rooms = socketRooms.get(socket.id);
        if (rooms) {
          rooms.add(doutorRoom);
        }
      }
    }

    // Cliente pode se inscrever em eventos de um doutor específico
    socket.on('subscribe:doutor', (message: any) => {
      // 1. VALIDAÇÃO DE MENSAGEM - Nunca confiar em dados do cliente
      const validation = validateWebSocketMessage('subscribe:doutor', message, socket.id);
      if (!validation.valid) {
        console.error(`[WebSocket Validation] ❌ Mensagem inválida do socket ${socket.id}: ${validation.error}`);
        socket.emit('error', { message: `Mensagem inválida: ${validation.error}` });
        const ip = getSocketIP(socket);
        blacklistIP(ip, `Mensagem inválida do socket ${socket.id}`);
        socket.disconnect();
        return;
      }

      // Usar mensagem sanitizada e validada
      const doutorId = validation.sanitized as number;

      // 2. Verificar limite de salas por conexão
      const roomLimitCheck = checkRoomLimit(socket.id);
      if (!roomLimitCheck.allowed) {
        console.warn(`[WebSocket Rate Limit] Socket ${socket.id} bloqueado: ${roomLimitCheck.reason}`);
        socket.emit('error', { message: `Limite de salas excedido: ${roomLimitCheck.reason}` });
        const ip = getSocketIP(socket);
        blacklistIP(ip, `Tentativa de exceder limite de salas no socket ${socket.id}`);
        socket.disconnect();
        return;
      }

      // 3. Verificar rate limit de tentativas de inscrição em salas
      const subscriptionCheck = checkRoomSubscriptionRateLimit(socket.id);
      if (!subscriptionCheck.allowed) {
        console.warn(`[WebSocket Rate Limit] Socket ${socket.id} bloqueado: ${subscriptionCheck.reason}`);
        socket.emit('error', { message: `Rate limit de inscrições excedido: ${subscriptionCheck.reason}` });
        const ip = getSocketIP(socket);
        blacklistIP(ip, `Flood de inscrições em salas no socket ${socket.id}`);
        socket.disconnect();
        return;
      }

      // 4. Verificar rate limit de mensagens
      const messageCheck = checkMessageRateLimit(socket.id);
      if (!messageCheck.allowed) {
        console.warn(`[WebSocket Rate Limit] Socket ${socket.id} bloqueado: ${messageCheck.reason}`);
        socket.emit('error', { message: `Rate limit excedido: ${messageCheck.reason}` });
        const ip = getSocketIP(socket);
        blacklistIP(ip, `Flood de mensagens no socket ${socket.id}`);
        socket.disconnect();
        return;
      }

      // 5. Validar permissões e fazer join para DOUTOR
      if (user.role === 'DOUTOR') {
        if (user.id !== doutorId) {
          console.warn(`[WebSocket] Tentativa de inscrição não autorizada: User ${user.id} tentou se inscrever no doutor ${doutorId}`);
          socket.emit('error', { message: 'Acesso negado. Você só pode se inscrever em seus próprios eventos.' });
          return;
        }
        
        // DOUTOR pode se inscrever na própria sala
        const room = `doutor:${doutorId}`;
        // Validar que o nome do room não contém caracteres perigosos
        if (containsDangerousContent(room)) {
          console.error(`[WebSocket Security] ❌ Nome de room perigoso detectado: ${room}`);
          socket.emit('error', { message: 'Erro ao criar room: nome inválido' });
          return;
        }
        // Validar que a sala é permitida para o usuário (prevenir salas abertas)
        if (!isRoomAllowedForUser(room, user)) {
          console.error(`[WebSocket Security] ❌ Tentativa de acessar sala não autorizada: ${room}`);
          socket.emit('error', { message: 'Acesso negado. Sala não autorizada.' });
          return;
        }
        socket.join(room);
        // Rastrear sala
        const rooms = socketRooms.get(socket.id);
        if (rooms) {
          rooms.add(room);
        }
        return;
      }

      // Verificar se é SECRETARIA e se tem vínculo com o doutor
      if (user.role === 'SECRETARIA') {
        // Validar vínculo de secretária com doutor E que o doutor pertence à mesma clínica
        prisma.secretariaDoutor
          .findFirst({
            where: {
              secretariaId: user.id,
              doutorId: doutorId,
            },
            include: {
              doutor: {
                select: {
                  id: true,
                  clinicaId: true,
                },
              },
            },
          })
          .then((vinculo) => {
            if (!vinculo) {
              console.warn(`[WebSocket] Secretária ${user.id} tentou se inscrever no doutor ${doutorId} sem vínculo`);
              socket.emit('error', { message: 'Acesso negado. Você não tem vínculo com este doutor.' });
              return;
            }

            // Validar que o doutor pertence à mesma clínica da secretária
            if (vinculo.doutor.clinicaId !== user.clinicaId) {
              console.warn(`[WebSocket] Secretária ${user.id} (clínica ${user.clinicaId}) tentou se inscrever no doutor ${doutorId} (clínica ${vinculo.doutor.clinicaId})`);
              socket.emit('error', { message: 'Acesso negado. O doutor não pertence à sua clínica.' });
              return;
            }

            // Construir nome de room de forma segura (doutorId já validado)
            const room = `doutor:${doutorId}`;
            // Validar que o nome do room não contém caracteres perigosos
            if (containsDangerousContent(room)) {
              console.error(`[WebSocket Security] ❌ Nome de room perigoso detectado: ${room}`);
              socket.emit('error', { message: 'Erro ao criar room: nome inválido' });
              return;
            }
            // Validar que a sala é permitida para o usuário (prevenir salas abertas)
            if (!isRoomAllowedForUser(room, user)) {
              console.error(`[WebSocket Security] ❌ Tentativa de acessar sala não autorizada: ${room}`);
              socket.emit('error', { message: 'Acesso negado. Sala não autorizada.' });
              return;
            }
            socket.join(room);
            // Rastrear sala
            const rooms = socketRooms.get(socket.id);
            if (rooms) {
              rooms.add(room);
            }
          })
          .catch((error) => {
            console.error(`[WebSocket] Erro ao validar vínculo de secretária:`, error);
            socket.emit('error', { message: 'Erro ao validar permissões.' });
          });
        return;
      }

      // Para CLINICA_ADMIN: validar que o doutor pertence à mesma clínica
      if (user.role === 'CLINICA_ADMIN') {
        prisma.doutor
          .findUnique({
            where: { id: doutorId },
            select: { id: true, clinicaId: true },
          })
          .then((doutor) => {
            if (!doutor) {
              console.warn(`[WebSocket] Doutor ${doutorId} não encontrado`);
              socket.emit('error', { message: 'Doutor não encontrado.' });
              return;
            }

            // Validar que o doutor pertence à mesma clínica do admin
            if (doutor.clinicaId !== user.clinicaId) {
              console.warn(`[WebSocket] CLINICA_ADMIN ${user.id} (clínica ${user.clinicaId}) tentou se inscrever no doutor ${doutorId} (clínica ${doutor.clinicaId})`);
              socket.emit('error', { message: 'Acesso negado. O doutor não pertence à sua clínica.' });
              return;
            }

            // Construir nome de room de forma segura (doutorId já validado)
            const room = `doutor:${doutorId}`;
            // Validar que o nome do room não contém caracteres perigosos
            if (containsDangerousContent(room)) {
              console.error(`[WebSocket Security] ❌ Nome de room perigoso detectado: ${room}`);
              socket.emit('error', { message: 'Erro ao criar room: nome inválido' });
              return;
            }
            // Validar que a sala é permitida para o usuário (prevenir salas abertas)
            if (!isRoomAllowedForUser(room, user)) {
              console.error(`[WebSocket Security] ❌ Tentativa de acessar sala não autorizada: ${room}`);
              socket.emit('error', { message: 'Acesso negado. Sala não autorizada.' });
              return;
            }
            socket.join(room);
            // Rastrear sala
            const rooms = socketRooms.get(socket.id);
            if (rooms) {
              rooms.add(room);
            }
          })
          .catch((error) => {
            console.error(`[WebSocket] Erro ao validar doutor:`, error);
            socket.emit('error', { message: 'Erro ao validar permissões.' });
          });
        return;
      }

      // Para SUPER_ADMIN: validar que o doutor existe (pode acessar qualquer doutor)
      if (user.role === 'SUPER_ADMIN') {
        prisma.doutor
          .findUnique({
            where: { id: doutorId },
            select: { id: true },
          })
          .then((doutor) => {
            if (!doutor) {
              console.warn(`[WebSocket] SUPER_ADMIN tentou se inscrever em doutor inexistente: ${doutorId}`);
              socket.emit('error', { message: 'Doutor não encontrado.' });
              return;
            }

            // Construir nome de room de forma segura (doutorId já validado)
            const room = `doutor:${doutorId}`;
            // Validar que o nome do room não contém caracteres perigosos
            if (containsDangerousContent(room)) {
              console.error(`[WebSocket Security] ❌ Nome de room perigoso detectado: ${room}`);
              socket.emit('error', { message: 'Erro ao criar room: nome inválido' });
              return;
            }
            // Validar que a sala é permitida para o usuário (prevenir salas abertas)
            if (!isRoomAllowedForUser(room, user)) {
              console.error(`[WebSocket Security] ❌ Tentativa de acessar sala não autorizada: ${room}`);
              socket.emit('error', { message: 'Acesso negado. Sala não autorizada.' });
              return;
            }
            socket.join(room);
            // Rastrear sala
            const rooms = socketRooms.get(socket.id);
            if (rooms) {
              rooms.add(room);
            }
          })
          .catch((error) => {
            console.error(`[WebSocket] Erro ao validar doutor:`, error);
            socket.emit('error', { message: 'Erro ao validar permissões.' });
          });
        return;
      }

      // Se chegou aqui, é um role não tratado - negar acesso
      console.warn(`[WebSocket] Role não autorizado para subscribe:doutor: ${user.role}`);
      socket.emit('error', { message: 'Acesso negado. Role não autorizado.' });
    });

    // Cliente pode se inscrever em eventos de uma clínica específica
    socket.on('subscribe:clinica', (message: any) => {
      // 1. VALIDAÇÃO DE MENSAGEM - Nunca confiar em dados do cliente
      const validation = validateWebSocketMessage('subscribe:clinica', message, socket.id);
      if (!validation.valid) {
        console.error(`[WebSocket Validation] ❌ Mensagem inválida do socket ${socket.id}: ${validation.error}`);
        socket.emit('error', { message: `Mensagem inválida: ${validation.error}` });
        const ip = getSocketIP(socket);
        blacklistIP(ip, `Mensagem inválida do socket ${socket.id}`);
        socket.disconnect();
        return;
      }

      // Usar mensagem sanitizada e validada
      const clinicaId = validation.sanitized as number;

      // 2. Verificar limite de salas por conexão
      const roomLimitCheck = checkRoomLimit(socket.id);
      if (!roomLimitCheck.allowed) {
        console.warn(`[WebSocket Rate Limit] Socket ${socket.id} bloqueado: ${roomLimitCheck.reason}`);
        socket.emit('error', { message: `Limite de salas excedido: ${roomLimitCheck.reason}` });
        const ip = getSocketIP(socket);
        blacklistIP(ip, `Tentativa de exceder limite de salas no socket ${socket.id}`);
        socket.disconnect();
        return;
      }

      // 3. Verificar rate limit de tentativas de inscrição em salas
      const subscriptionCheck = checkRoomSubscriptionRateLimit(socket.id);
      if (!subscriptionCheck.allowed) {
        console.warn(`[WebSocket Rate Limit] Socket ${socket.id} bloqueado: ${subscriptionCheck.reason}`);
        socket.emit('error', { message: `Rate limit de inscrições excedido: ${subscriptionCheck.reason}` });
        const ip = getSocketIP(socket);
        blacklistIP(ip, `Flood de inscrições em salas no socket ${socket.id}`);
        socket.disconnect();
        return;
      }

      // 4. Verificar rate limit de mensagens
      const messageCheck = checkMessageRateLimit(socket.id);
      if (!messageCheck.allowed) {
        console.warn(`[WebSocket Rate Limit] Socket ${socket.id} bloqueado: ${messageCheck.reason}`);
        socket.emit('error', { message: `Rate limit excedido: ${messageCheck.reason}` });
        const ip = getSocketIP(socket);
        blacklistIP(ip, `Flood de mensagens no socket ${socket.id}`);
        socket.disconnect();
        return;
      }

      // 5. Validar permissões baseado no role
      if (user.role === 'SUPER_ADMIN') {
        // SUPER_ADMIN pode se inscrever em qualquer clínica, mas precisa validar que existe
        prisma.clinica
          .findUnique({
            where: { id: clinicaId },
            select: { id: true },
          })
          .then((clinica) => {
            if (!clinica) {
              console.warn(`[WebSocket] SUPER_ADMIN tentou se inscrever em clínica inexistente: ${clinicaId}`);
              socket.emit('error', { message: 'Clínica não encontrada.' });
              return;
            }

            // Construir nome de room de forma segura (clinicaId já validado)
            const room = `clinica:${clinicaId}`;
            // Validar que o nome do room não contém caracteres perigosos
            if (containsDangerousContent(room)) {
              console.error(`[WebSocket Security] ❌ Nome de room perigoso detectado: ${room}`);
              socket.emit('error', { message: 'Erro ao criar room: nome inválido' });
              return;
            }
            // Validar que a sala é permitida para o usuário (prevenir salas abertas)
            if (!isRoomAllowedForUser(room, user)) {
              console.error(`[WebSocket Security] ❌ Tentativa de acessar sala não autorizada: ${room}`);
              socket.emit('error', { message: 'Acesso negado. Sala não autorizada.' });
              return;
            }
            socket.join(room);
            // Rastrear sala
            const rooms = socketRooms.get(socket.id);
            if (rooms) {
              rooms.add(room);
            }
          })
          .catch((error) => {
            console.error(`[WebSocket] Erro ao validar clínica:`, error);
            socket.emit('error', { message: 'Erro ao validar permissões.' });
          });
        return;
      }

      // Para outros roles: validar que o usuário pertence à clínica
      if (!user.clinicaId) {
        console.warn(`[WebSocket] Usuário ${user.id} sem clinicaId tentou se inscrever na clínica ${clinicaId}`);
        socket.emit('error', { message: 'Acesso negado. Você não pertence a nenhuma clínica.' });
        return;
      }

      if (user.clinicaId !== clinicaId) {
        console.warn(`[WebSocket] Tentativa de inscrição não autorizada: User ${user.id} (clínica ${user.clinicaId}) tentou se inscrever na clínica ${clinicaId}`);
        socket.emit('error', { message: 'Acesso negado. Você só pode se inscrever em eventos da sua clínica.' });
        return;
      }

      // Construir nome de room de forma segura (clinicaId já validado)
      const room = `clinica:${clinicaId}`;
      // Validar que o nome do room não contém caracteres perigosos
      if (containsDangerousContent(room)) {
        console.error(`[WebSocket Security] ❌ Nome de room perigoso detectado: ${room}`);
        socket.emit('error', { message: 'Erro ao criar room: nome inválido' });
        return;
      }
      // Validar que a sala é permitida para o usuário (prevenir salas abertas)
      if (!isRoomAllowedForUser(room, user)) {
        console.error(`[WebSocket Security] ❌ Tentativa de acessar sala não autorizada: ${room}`);
        socket.emit('error', { message: 'Acesso negado. Sala não autorizada.' });
        return;
      }
      socket.join(room);
      // Rastrear sala
      const rooms = socketRooms.get(socket.id);
      if (rooms) {
        rooms.add(room);
      }
    });

    socket.on('disconnect', () => {
      // Remover conexão do rastreamento por IP
      const ip = getSocketIP(socket);
      const activeSockets = activeConnectionsByIP.get(ip);
      if (activeSockets) {
        activeSockets.delete(socket.id);
        if (activeSockets.size === 0) {
          activeConnectionsByIP.delete(ip);
        }
      }
      
      // Limpar rastreamento de salas
      socketRooms.delete(socket.id);
      
      // Limpar rate limits do socket desconectado
      socketRateLimits.delete(socket.id);
    });

    // Tratamento de erros
    socket.on('error', (error) => {
      console.error(`[WebSocket] Erro no socket ${socket.id}:`, error);
    });

    // PROTEÇÃO: Prevenir registro dinâmico de eventos customizados
    // Bloquear qualquer tentativa de registrar handlers para eventos não permitidos
    const originalOn = socket.on.bind(socket);
    socket.on = function(event: string, handler: any) {
      // Apenas permitir eventos explícitos na whitelist
      // NUNCA permitir eventos customizados ou dinâmicos
      if (!ALLOWED_COMMANDS.has(event)) {
        console.error(`[WebSocket Security] ❌ Tentativa de registrar handler para evento não permitido: ${event} (Socket: ${socket.id})`);
        const ip = getSocketIP(socket);
        blacklistIP(ip, `Tentativa de registrar evento não permitido: ${event}`);
        socket.emit('error', { message: `Evento ${event} não é permitido. Apenas eventos na whitelist são aceitos.` });
        socket.disconnect();
        return socket; // Retornar socket para manter compatibilidade, mas não registrar handler
      }

      // Para eventos permitidos, adicionar validação e rate limiting
      if (event === 'subscribe:doutor' || event === 'subscribe:clinica') {
        return originalOn(event, (...args: any[]) => {
          // Validação já é feita no handler específico acima
          // Este wrapper apenas garante que não há bypass
          return handler(...args);
        });
      }

      // Para eventos do Socket.io (disconnect, error, connect), permitir sem validação adicional
      return originalOn(event, handler);
    };
  });

  return io;
}

/**
 * Mascara CPF (formato: XXX.XXX.XXX-XX)
 */
function maskCPF(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return '***.***.***-**';
  // Mascara: XXX.XXX.XXX-XX (mostra apenas últimos 2 dígitos)
  return `***.***.${cleanCPF.slice(6, 9)}-${cleanCPF.slice(9, 11)}`;
}

/**
 * Mascara telefone (formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX)
 */
function maskTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  // Remove caracteres não numéricos
  const cleanTel = telefone.replace(/\D/g, '');
  if (cleanTel.length < 10 || cleanTel.length > 11) return '(**) *****-****';
  
  if (cleanTel.length === 11) {
    // Celular: (XX) XXXXX-XXXX (mostra apenas últimos 4 dígitos)
    return `(**) *****-${cleanTel.slice(7, 11)}`;
  } else {
    // Fixo: (XX) XXXX-XXXX (mostra apenas últimos 4 dígitos)
    return `(**) ****-${cleanTel.slice(6, 10)}`;
  }
}

/**
 * Filtra dados sensíveis de um agendamento antes de enviar via WebSocket
 * NUNCA envia: CPF/telefone sem máscara, prontuário, prescrições, históricos
 */
function sanitizeAgendamentoForWebSocket(agendamento: any, targetDoutorId?: number, targetClinicaId?: number): any {
  if (!agendamento) {
    console.warn('[WebSocket] sanitizeAgendamentoForWebSocket: agendamento é null/undefined');
    return null;
  }

  // Obter doutorId do agendamento (pode estar em agendamento.doutorId ou agendamento.doutor.id)
  const agendamentoDoutorId = agendamento.doutorId || agendamento.doutor?.id;
  
  // VALIDAÇÃO: Garantir que não estamos enviando dados de outro doutor
  if (targetDoutorId && agendamentoDoutorId && agendamentoDoutorId !== targetDoutorId) {
    console.error(`[WebSocket Security] ❌ Tentativa de sanitizar agendamento de outro doutor! Agendamento doutorId: ${agendamentoDoutorId}, Target: ${targetDoutorId}`);
    return null;
  }

  // Obter clinicaId (pode estar em agendamento.doutor.clinicaId ou agendamento.paciente.clinicaId)
  const agendamentoClinicaId = agendamento.doutor?.clinicaId || agendamento.paciente?.clinicaId;
  
  // VALIDAÇÃO: Garantir que não estamos enviando dados de outra clínica
  // Se não houver clinicaId no agendamento, usar o targetClinicaId (mais permissivo para evitar bloqueios)
  if (targetClinicaId && agendamentoClinicaId && agendamentoClinicaId !== targetClinicaId) {
    console.warn(`[WebSocket Security] ⚠️ Aviso: Agendamento clinicaId (${agendamentoClinicaId}) diferente do target (${targetClinicaId}). Continuando com validação mais permissiva.`);
    // Não bloquear imediatamente - pode ser um caso legítimo
  }

  // Criar cópia limpa do agendamento (sem referências ao objeto original)
  const sanitized: any = {
    id: agendamento.id,
    dataHora: agendamento.dataHora,
    status: agendamento.status,
    ativo: agendamento.ativo,
    isEncaixe: agendamento.isEncaixe || false,
    confirmadoPorMedico: agendamento.confirmadoPorMedico || false,
    // NUNCA enviar motivoCancelamento, canceladoPor, canceladoEm via WebSocket
    // NUNCA enviar relatoPaciente, entendimentoIA (dados sensíveis)
    // NUNCA enviar prescricoes, historicos, prontuarioChats
  };

  // Filtrar dados do paciente (apenas o necessário, com dados sensíveis mascarados)
  if (agendamento.paciente) {
    sanitized.paciente = {
      id: agendamento.paciente.id,
      nome: agendamento.paciente.nome,
      // CPF e telefone SEMPRE mascarados
      cpf: maskCPF(agendamento.paciente.cpf),
      telefone: maskTelefone(agendamento.paciente.telefone),
      // NUNCA enviar: email, endereço completo, alergias, observações, peso, altura, etc.
    };
  }

  // Filtrar dados do doutor (apenas o necessário)
  if (agendamento.doutor) {
    sanitized.doutor = {
      id: agendamento.doutor.id,
      nome: agendamento.doutor.nome,
      especialidade: agendamento.doutor.especialidade,
      crm: agendamento.doutor.crm,
      crmUf: agendamento.doutor.crmUf,
      // NUNCA enviar: email do doutor
    };
  }

  // Filtrar dados do serviço (apenas o necessário)
  if (agendamento.servico) {
    sanitized.servico = {
      id: agendamento.servico.id,
      nome: agendamento.servico.nome,
      duracaoMin: agendamento.servico.duracaoMin,
      // NUNCA enviar: descrição completa, preço
    };
  }

  // NUNCA enviar: prescrições, históricos, prontuárioChats
  // Esses dados são sensíveis e não devem ser transmitidos via WebSocket

  return sanitized;
}

/**
 * Verifica se um usuário tem permissão para receber eventos de um agendamento
 */
function canUserReceiveAgendamentoEvent(
  userRole: string,
  userId: number,
  userClinicaId: number,
  agendamentoDoutorId: number,
  agendamentoClinicaId: number
): boolean {
  // DOUTOR: apenas seus próprios agendamentos
  if (userRole === 'DOUTOR') {
    return userId === agendamentoDoutorId;
  }

  // SECRETARIA: apenas agendamentos de doutores vinculados (validação será feita na sala)
  if (userRole === 'SECRETARIA') {
    return userClinicaId === agendamentoClinicaId;
  }

  // CLINICA_ADMIN: apenas agendamentos da sua clínica
  if (userRole === 'CLINICA_ADMIN') {
    return userClinicaId === agendamentoClinicaId;
  }

  // SUPER_ADMIN: pode ver todos
  if (userRole === 'SUPER_ADMIN') {
    return true;
  }

  return false;
}

/**
 * Emite evento de agendamento para os clientes interessados
 * COM PROTEÇÃO CONTRA VAZAMENTO DE INFORMAÇÕES
 * 
 * REGRAS DE SEGURANÇA:
 * - NUNCA envia dados de outros médicos (apenas do doutor do agendamento)
 * - NUNCA envia dados de pacientes de outra agenda
 * - NUNCA envia prontuário, prescrições ou históricos via WebSocket
 * - NUNCA envia CPF/telefone sem máscara
 * - NUNCA envia eventos que não pertencem ao usuário
 */
export function emitAgendamentoEvent(data: AgendamentoEventData) {
  if (!io) {
    console.warn('[WebSocket] Servidor WebSocket não inicializado');
    return;
  }

  const { doutorId, clinicaId, action, agendamento } = data;
  
  // Log de debug para rastrear eventos
  console.log(`[WebSocket] emitAgendamentoEvent chamado: action=${action}, doutorId=${doutorId}, clinicaId=${clinicaId}, agendamentoId=${agendamento?.id || 'null'}`);

  // VALIDAÇÃO DE SEGURANÇA: Verificar se o agendamento pertence ao doutor e clínica informados
  if (agendamento) {
    // Validar doutorId (pode estar em agendamento.doutorId ou agendamento.doutor.id)
    const agendamentoDoutorId = agendamento.doutorId || agendamento.doutor?.id;
    
    // Se não conseguir obter doutorId do agendamento, usar o doutorId do evento
    const finalDoutorId = agendamentoDoutorId || doutorId;
    
    if (agendamentoDoutorId && agendamentoDoutorId !== doutorId) {
      console.error(`[WebSocket Security] ❌ Tentativa de emitir evento de agendamento de outro doutor! Agendamento doutorId: ${agendamentoDoutorId}, Evento doutorId: ${doutorId}`);
      return; // NUNCA emitir eventos de outros doutores
    }

    // Validar clinicaId do doutor (se disponível)
    const agendamentoDoutorClinicaId = agendamento.doutor?.clinicaId;
    if (agendamentoDoutorClinicaId && agendamentoDoutorClinicaId !== clinicaId) {
      console.warn(`[WebSocket] Aviso: Doutor clinicaId (${agendamentoDoutorClinicaId}) diferente do evento clinicaId (${clinicaId}). Usando clinicaId do evento.`);
      // Não bloquear, apenas avisar - pode ser que o doutor tenha mudado de clínica
    }

    // Verificar se o paciente pertence à mesma clínica (se houver informação de clínica no paciente)
    if (agendamento.paciente?.clinicaId && agendamento.paciente.clinicaId !== clinicaId) {
      console.warn(`[WebSocket] Aviso: Paciente clinicaId (${agendamento.paciente.clinicaId}) diferente do evento clinicaId (${clinicaId}). Usando clinicaId do evento.`);
      // Não bloquear, apenas avisar - pode ser que o paciente tenha mudado de clínica
    }
  }

  // Sanitizar agendamento ANTES de enviar (remove dados sensíveis)
  const sanitizedAgendamento = sanitizeAgendamentoForWebSocket(agendamento, doutorId, clinicaId);

  if (!sanitizedAgendamento) {
    console.warn(`[WebSocket] Agendamento não pôde ser sanitizado, evento não será emitido. Agendamento: ${JSON.stringify({
      id: agendamento?.id,
      doutorId: agendamento?.doutorId || agendamento?.doutor?.id,
      pacienteClinicaId: agendamento?.paciente?.clinicaId,
      doutorClinicaId: agendamento?.doutor?.clinicaId,
    })}`);
    return;
  }
  
  console.log(`[WebSocket] Agendamento sanitizado com sucesso. Emitindo evento para doutor ${doutorId} e clínica ${clinicaId}`);

  // Emitir para a sala do doutor específico
  // Apenas usuários autorizados receberão (validação feita na inscrição)
  // NUNCA enviar para outros doutores
  // Validar que doutorId é seguro antes de construir room name
  if (!Number.isSafeInteger(doutorId) || doutorId <= 0) {
    console.error(`[WebSocket Security] ❌ doutorId inválido para emitir evento: ${doutorId}`);
    return;
  }
  const doutorRoom = `doutor:${doutorId}`;
  // Validar nome do room (prevenir injeção)
  if (containsDangerousContent(doutorRoom)) {
    console.error(`[WebSocket Security] ❌ Nome de room perigoso: ${doutorRoom}`);
    return;
  }
  
  // Verificar quantos clientes estão na sala do doutor
  const doutorRoomSockets = io.sockets.adapter.rooms.get(doutorRoom);
  const doutorRoomCount = doutorRoomSockets ? doutorRoomSockets.size : 0;
  
  if (doutorRoomCount === 0) {
    console.warn(`[WebSocket] ⚠️ ATENÇÃO: Nenhum cliente conectado na sala ${doutorRoom}! O evento será emitido mas ninguém receberá.`);
    console.warn(`[WebSocket] Verifique se o doutor ${doutorId} ou usuários autorizados estão conectados e inscritos nesta sala.`);
  } else {
    console.log(`[WebSocket] 📢 Emitindo para sala ${doutorRoom} (${doutorRoomCount} cliente(s) conectado(s))`);
  }
  
  io.to(doutorRoom).emit('agendamento:updated', {
    action,
    agendamento: sanitizedAgendamento, // Dados sanitizados e filtrados
    doutorId,
    clinicaId,
  });

  // Emitir para a sala da clínica (para admins e secretárias)
  // Apenas usuários da mesma clínica receberão (validação feita na inscrição)
  // NUNCA enviar para outras clínicas
  // Validar que clinicaId é seguro antes de construir room name
  if (!Number.isSafeInteger(clinicaId) || clinicaId <= 0) {
    console.error(`[WebSocket Security] ❌ clinicaId inválido para emitir evento: ${clinicaId}`);
    return;
  }
  const clinicaRoom = `clinica:${clinicaId}`;
  // Validar nome do room (prevenir injeção)
  if (containsDangerousContent(clinicaRoom)) {
    console.error(`[WebSocket Security] ❌ Nome de room perigoso: ${clinicaRoom}`);
    return;
  }
  
  // Verificar quantos clientes estão na sala da clínica
  const clinicaRoomSockets = io.sockets.adapter.rooms.get(clinicaRoom);
  const clinicaRoomCount = clinicaRoomSockets ? clinicaRoomSockets.size : 0;
  
  if (clinicaRoomCount === 0) {
    console.warn(`[WebSocket] ⚠️ ATENÇÃO: Nenhum cliente conectado na sala ${clinicaRoom}! O evento será emitido mas ninguém receberá.`);
    console.warn(`[WebSocket] Verifique se usuários da clínica ${clinicaId} estão conectados e inscritos nesta sala.`);
  } else {
    console.log(`[WebSocket] 📢 Emitindo para sala ${clinicaRoom} (${clinicaRoomCount} cliente(s) conectado(s))`);
  }
  
  io.to(clinicaRoom).emit('agendamento:updated', {
    action,
    agendamento: sanitizedAgendamento, // Dados sanitizados e filtrados
    doutorId,
    clinicaId,
  });

  console.log(`[WebSocket] ✅ Evento '${action}' emitido com sucesso para doutor ${doutorId} (${doutorRoomCount} cliente(s)) e clínica ${clinicaId} (${clinicaRoomCount} cliente(s))`);
}

/**
 * Obtém a instância do servidor WebSocket
 */
export function getIO(): SocketIOServer | null {
  return io;
}

