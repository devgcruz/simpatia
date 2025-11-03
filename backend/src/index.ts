import express, {Request, Response} from 'express';
import cors from 'cors';

import servicoRoutes from './routes/servicos.routes';
import servicoPaciente from './routes/paciente.route';

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());

app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'API da Clínica está rodando!' });
});

app.use('/api/servicos', servicoRoutes);
app.use('/api/pacientes', servicoPaciente);

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});