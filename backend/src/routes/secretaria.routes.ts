import { Router } from 'express';
import secretariaController from '../controllers/secretaria.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', secretariaController.handleGetAll);
router.get('/:id', secretariaController.handleGetById);
router.post('/', secretariaController.handleCreate);
router.put('/:id', secretariaController.handleUpdate);
router.delete('/:id', secretariaController.handleDelete);

export default router;


