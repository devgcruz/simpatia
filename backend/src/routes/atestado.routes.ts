import { Router } from 'express';
import atestadoController from '../controllers/atestado.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', atestadoController.create);
router.get('/', atestadoController.getAll);
router.get('/paciente/:pacienteId', atestadoController.findByPaciente);
router.get('/protocolo/:protocolo', atestadoController.findByProtocolo);
router.get('/:id', atestadoController.getById);
router.put('/:id', atestadoController.update);
router.delete('/:id', atestadoController.delete);

export default router;

