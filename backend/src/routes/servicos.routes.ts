import { Router } from 'express';
import servicosController from '../controllers/servicos.controller';

const router = Router();

router.get('/', servicosController.handleGetAll);

router.post('/', servicosController.handleCreate);

router.get('/:id', servicosController.handleGetById);

router.put('/:id', servicosController.handleUpdate);

router.delete('/:id', servicosController.handleDelete);

export default router;