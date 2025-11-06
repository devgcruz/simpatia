import { Router } from 'express';
import disponibilidadeController from '../controllers/disponibilidade.controller';

const router = Router();

router.get('/', disponibilidadeController.handleGetDisponibilidade);

export default router;

