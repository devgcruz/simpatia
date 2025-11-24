import 'dotenv/config';
import express, { Request, Response } from 'express';
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
import uploadRoutes from './routes/upload.routes';
import { authMiddleware, isSuperAdmin } from './middleware/auth.middleware';
import indisponibilidadeRoutes from './routes/indisponibilidade.routes';
import pausaExcecaoRoutes from './routes/pausa-excecao.routes';
import prescricaoRoutes from './routes/prescricao.routes';
import medicamentoRoutes from './routes/medicamento.routes';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3333;

// --- Middlewares de Segurança (DEVE VIR CEDO) ---

// Proteção (HTTPS/HSTS): Força HTTPS e adiciona HSTS (Strict-Transport-Security)
// O Helmet já faz isso se detectar que 'NODE_ENV' é 'production'
// Proteção (Clickjacking): Helmet já adiciona X-Frame-Options: 'SAMEORIGIN'
// Proteção (CSP): Helmet adiciona um CSP básico (pode ser customizado)
app.use(helmet());

// Configuração CORS para permitir credenciais (cookies)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, // Permite cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json()); // Leitor de JSON
app.use(express.urlencoded({ extended: true })); // Para multipart/form-data
app.use(cookieParser()); // Leitor de Cookies (Necessário para o auth)

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
app.use('/api/upload', uploadRoutes);
app.use('/api/prescricoes', prescricaoRoutes);
app.use('/api/medicamentos', medicamentoRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});