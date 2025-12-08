import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.routes';
import servicoRoutes from './routes/servicos.routes';
import pacienteRoutes from './routes/paciente.route';
import doutorRoutes from './routes/doutor.routes';
import horarioRoutes from './routes/horario.routes';
import agendamentoRoutes from './routes/agendamento.routes';
import disponibilidadeRoutes from './routes/disponibilidade.routes';
import clinicaRoutes from './routes/clinica.routes';
import webhookRoutes from './routes/webhook.routes';
import chatRoutes from './routes/chat.routes';
import chatInternoRoutes from './routes/chat-interno.routes';
import uploadRoutes from './routes/upload.routes';
import { authMiddleware, isSuperAdmin } from './middleware/auth.middleware';
import indisponibilidadeRoutes from './routes/indisponibilidade.routes';
import pausaExcecaoRoutes from './routes/pausa-excecao.routes';
import prescricaoRoutes from './routes/prescricao.routes';
import medicamentoRoutes from './routes/medicamento.routes';
import secretariaRoutes from './routes/secretaria.routes';
import alergiaRoutes from './routes/alergia.routes';
import { initializeWebSocket } from './services/websocket.service';
import { initializeChatInternoWebSocket } from './services/websocket-chat-interno.service';

const app = express();

// Configuração HTTPS para desenvolvimento
const USE_HTTPS = process.env.USE_HTTPS === 'true' || process.env.NODE_ENV === 'production';
let httpServer;

if (USE_HTTPS) {
  const certDir = path.join(__dirname, '../certs');
  const keyPath = path.join(certDir, 'dev-key.pem');
  const certPath = path.join(certDir, 'dev-cert.pem');

  // Verificar se os certificados existem
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    httpServer = createHttpsServer(options, app);
    console.log('🔐 HTTPS habilitado com certificados de desenvolvimento');
  } else {
    console.warn('⚠️  Certificados SSL não encontrados. Use: npm run generate-cert');
    console.warn('   Continuando com HTTP...');
    httpServer = createHttpServer(app);
  }
} else {
  httpServer = createHttpServer(app);
}

const PORT = process.env.PORT || 3333;

// IMPORTANTE: Inicializar WebSockets ANTES dos middlewares do Express
// para evitar conflitos com CORS e outros middlewares
initializeWebSocket(httpServer);
initializeChatInternoWebSocket(httpServer);

// --- Middlewares de Segurança (DEVE VIR CEDO) ---

// Proteção (HTTPS/HSTS): Força HTTPS e adiciona HSTS (Strict-Transport-Security)
// O Helmet já faz isso se detectar que 'NODE_ENV' é 'production'
// Proteção (Clickjacking): Helmet já adiciona X-Frame-Options: 'SAMEORIGIN'
// Proteção (CSP): Helmet adiciona um CSP básico (pode ser customizado)
// Excluir rotas do Socket.IO do Helmet (Socket.IO precisa de headers específicos)
app.use((req, res, next) => {
  // Ignorar Helmet para rotas do Socket.IO
  if (req.path.startsWith('/socket.io')) {
    return next();
  }
  helmet()(req, res, next);
});

// Configuração CORS para permitir credenciais (cookies)
// IMPORTANTE: Socket.IO gerencia seu próprio CORS, então não aplicamos CORS do Express
// para rotas do Socket.IO para evitar conflitos
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware para ignorar rotas do Socket.IO em todos os middlewares
const skipSocketIO = (req: any, res: any, next: any) => {
  if (req.path && req.path.startsWith('/socket.io')) {
    return next();
  }
  return next();
};

app.use((req, res, next) => {
  // Ignorar CORS para rotas do Socket.IO - Socket.IO gerencia seu próprio CORS
  if (req.path && req.path.startsWith('/socket.io')) {
    return next();
  }
  return cors(corsOptions)(req, res, next);
});

// Ignorar middlewares de parsing para Socket.IO
app.use((req, res, next) => {
  if (req.path && req.path.startsWith('/socket.io')) {
    return next();
  }
  // Aumentar limite para 5MB para permitir upload de fotos em base64
  express.json({ limit: '5mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path && req.path.startsWith('/socket.io')) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '5mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path && req.path.startsWith('/socket.io')) {
    return next();
  }
  cookieParser()(req, res, next);
});

// Servir arquivos estáticos de uploads
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Rotas ---
// --- Rotas Públicas ---
// Estas rotas NÃO exigem autenticação.
app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'API da Clínica está rodando!' });
});

// Rota de Autenticação (Login/Logout)
app.use('/api/auth', authRoutes);

// Rota do Webhook (será pública para a Meta/WhatsApp)
app.use('/api/webhook/whatsapp', webhookRoutes);

// --- Barreira de Autenticação ---
// Todas as rotas definidas ABAIXO desta linha
// agora exigirão um token JWT válido.
app.use(authMiddleware);

// --- Rotas de SUPER ADMIN ---
app.use('/api/clinicas', isSuperAdmin, clinicaRoutes);

// --- Rota para buscar clínica atual do usuário (acessível a todos autenticados) ---
app.use('/api/clinica', clinicaRoutes);

// --- Rotas Protegidas ---
// (O middleware acima será executado antes de cada uma destas)
app.use('/api/doutores', doutorRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/servicos', servicoRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/disponibilidade', disponibilidadeRoutes);
app.use('/api/indisponibilidades', indisponibilidadeRoutes);
app.use('/api/pausa-excecoes', pausaExcecaoRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat-interno', chatInternoRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/prescricoes', prescricaoRoutes);
app.use('/api/medicamentos', medicamentoRoutes);
app.use('/api/secretarias', secretariaRoutes);
app.use('/api/alergias', alergiaRoutes);

httpServer.listen(PORT, () => {
  const isHttps = USE_HTTPS && 'key' in (httpServer as any).options;
  const protocol = isHttps ? 'https' : 'http';
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 URL: ${protocol}://localhost:${PORT}`);
  console.log(`📡 WebSocket habilitado`);
  if (isHttps) {
    console.log(`🔐 HTTPS/WSS habilitado`);
  }
});