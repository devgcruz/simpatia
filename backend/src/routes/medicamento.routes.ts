import { Router } from 'express';
import medicamentoController from '../controllers/medicamento.controller';

const router = Router();

router.get('/', medicamentoController.handleGetAll);
router.get('/principios-ativos', medicamentoController.handleGetPrincipiosAtivos);
router.post('/verificar-principio-ativo', medicamentoController.handleVerificarPrincipioAtivo);
router.post('/bulk', medicamentoController.handleBulkCreate);
router.get('/:id', medicamentoController.handleGetById);
router.post('/', medicamentoController.handleCreate);
router.put('/:id', medicamentoController.handleUpdate);
router.delete('/:id', medicamentoController.handleDelete);

export default router;

