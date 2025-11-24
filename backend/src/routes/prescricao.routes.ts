import { Router } from 'express';
import prescricaoController from '../controllers/prescricao.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', prescricaoController.create);
router.get('/', prescricaoController.getAll);
router.get('/paciente/:pacienteId', prescricaoController.findByPaciente);
router.get('/protocolo/:protocolo', prescricaoController.findByProtocolo);
router.get('/:id', prescricaoController.getById);
router.put('/:id', prescricaoController.update);
router.delete('/:id', prescricaoController.delete);

export default router;

