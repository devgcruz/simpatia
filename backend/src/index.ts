import express, {Request, Response} from 'express';
import cors from 'cors';

import servicoRoutes from './routes/servicos.routes';
import servicoPaciente from './routes/paciente.route';
import doutorRoutes from './routes/doutor.routes';
import horarioRoutes from './routes/horario.routes';
import agendamentoRoutes from './routes/agendamento.routes';
import disponibilidadeRoutes from './routes/disponibilidade.routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());

app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'API da Clínica está rodando!' });
});

app.use('/api/servicos', servicoRoutes);
app.use('/api/pacientes', servicoPaciente);
app.use('/api/doutores', doutorRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/disponibilidade', disponibilidadeRoutes);
app.use('/api/webhook/whatsapp', webhookRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});