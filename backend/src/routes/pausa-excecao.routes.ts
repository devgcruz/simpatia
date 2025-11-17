import { Router } from 'express';
import * as pausaExcecaoController from '../controllers/pausa-excecao.controller';

const router = Router();

// Listar exceções de pausa da clínica
router.get('/clinica', pausaExcecaoController.handleListByClinica);

// Listar exceções de pausa de um doutor
router.get('/doutor/:doutorId', pausaExcecaoController.handleListByDoutor);

// Criar exceção de pausa
router.post('/', pausaExcecaoController.handleCreate);

// Atualizar exceção de pausa
router.put('/:id', pausaExcecaoController.handleUpdate);

// Excluir exceção de pausa
router.delete('/:id', pausaExcecaoController.handleDelete);

export default router;

