import { Router } from 'express';
import doutorController from '../controllers/doutor.controller';

const router = Router();

router.get('/', doutorController.handleGetAll);

router.post('/', doutorController.handleCreate);

router.get('/:id', doutorController.handleGetById);

router.put('/:id', doutorController.handleUpdate);

router.delete('/:id', doutorController.handleDelete);

export default router;

