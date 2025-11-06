import { Router } from 'express';
import horarioController from '../controllers/horario.controller';

const router = Router();

router.get('/', horarioController.handleGetAll);

router.post('/', horarioController.handleCreate);

// IMPORTANTE: Esta rota deve vir ANTES da rota GET /:id
router.get('/doutor/:doutorId', horarioController.handleGetByDoutorId);

router.get('/:id', horarioController.handleGetById);

router.put('/:id', horarioController.handleUpdate);

router.delete('/:id', horarioController.handleDelete);

export default router;

