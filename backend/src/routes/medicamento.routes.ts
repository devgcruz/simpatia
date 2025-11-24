import { Router } from 'express';
import medicamentoController from '../controllers/medicamento.controller';

const router = Router();

router.get('/', medicamentoController.handleGetAll);
router.get('/:id', medicamentoController.handleGetById);
router.post('/', medicamentoController.handleCreate);
router.post('/bulk', medicamentoController.handleBulkCreate);
router.put('/:id', medicamentoController.handleUpdate);
router.delete('/:id', medicamentoController.handleDelete);

export default router;

