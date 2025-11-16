import { Router } from 'express';
import indisponibilidadeController from '../controllers/indisponibilidade.controller';

const router = Router();

// Lista todas as indisponibilidades da clínica do usuário
router.get('/', indisponibilidadeController.handleListByClinica);

// Lista por doutor específico
router.get('/doutor/:doutorId', indisponibilidadeController.handleListByDoutor);

// Cria uma indisponibilidade
router.post('/', indisponibilidadeController.handleCreate);

// Atualiza uma indisponibilidade
router.put('/:id', indisponibilidadeController.handleUpdate);

// Remove uma indisponibilidade
router.delete('/:id', indisponibilidadeController.handleDelete);

export default router;


