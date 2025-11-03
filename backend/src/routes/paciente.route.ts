import { Router } from 'express';
import pacienteController from '../controllers/paciente.controller';

const router = Router();

router.get('/', pacienteController.handleGetAll);

router.post('/', pacienteController.handleCreate);

router.get('/:id', pacienteController.handleGetById);

router.put('/:id', pacienteController.handleUpdate);

router.delete('/:id', pacienteController.handleDelete);

export default router;