import { Router } from 'express';
import alergiaController from '../controllers/alergia.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', alergiaController.handleCreate.bind(alergiaController));
router.get('/paciente/:pacienteId', alergiaController.handleGetByPaciente.bind(alergiaController));
router.post('/paciente/:pacienteId/verificar', alergiaController.handleVerificarAlergia.bind(alergiaController));
router.post('/paciente/:pacienteId/verificar-multiplos', alergiaController.handleVerificarAlergiasEmMedicamentos.bind(alergiaController));
router.put('/:id', alergiaController.handleUpdate.bind(alergiaController));
router.delete('/:id', alergiaController.handleDelete.bind(alergiaController));

export default router;

