import { Router } from 'express';
import clinicaController from '../controllers/clinica.controller';

const router = Router();

router.get('/', clinicaController.handleGetAll);
router.post('/', clinicaController.handleCreate);
router.get('/:id', clinicaController.handleGetById);
router.put('/:id', clinicaController.handleUpdate);
router.delete('/:id', clinicaController.handleDelete);

export default router;

