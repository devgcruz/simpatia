import { Router } from 'express';
import agendamentoController from '../controllers/agendamento.controller';
import prontuarioChatController from '../controllers/prontuarioChat.controller';

const router = Router();

router.get('/', agendamentoController.handleGetAll);

router.post('/', agendamentoController.handleCreate);

router.get('/:id', agendamentoController.handleGetById);

router.put('/:id', agendamentoController.handleUpdate);

router.post('/:id/finalizar', agendamentoController.handleFinalize);

router.get('/:id/prontuario-chat', prontuarioChatController.handleList);
router.post('/:id/prontuario-chat', prontuarioChatController.handleSend);

router.delete('/:id', agendamentoController.handleDelete);

export default router;

