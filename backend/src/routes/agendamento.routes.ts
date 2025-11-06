import { Router } from 'express';
import agendamentoController from '../controllers/agendamento.controller';

const router = Router();

router.get('/', agendamentoController.handleGetAll);

router.post('/', agendamentoController.handleCreate);

router.get('/:id', agendamentoController.handleGetById);

router.put('/:id', agendamentoController.handleUpdate);

router.delete('/:id', agendamentoController.handleDelete);

export default router;

