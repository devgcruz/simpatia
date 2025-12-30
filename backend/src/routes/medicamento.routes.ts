import { Router } from 'express';
import medicamentoController from '../controllers/medicamento.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Rotas de leitura (acessíveis para todas as roles)
router.get('/', medicamentoController.handleGetAll);
router.get('/principios-ativos', medicamentoController.handleGetPrincipiosAtivos);
router.post('/verificar-principio-ativo', medicamentoController.handleVerificarPrincipioAtivo);
router.get('/:id', medicamentoController.handleGetById);

// Rotas de escrita (apenas SUPER_ADMIN - validação no controller/service)
router.post('/bulk', medicamentoController.handleBulkCreate);
router.post('/', medicamentoController.handleCreate);
router.put('/:id', medicamentoController.handleUpdate);
router.delete('/:id', medicamentoController.handleDelete);

export default router;

