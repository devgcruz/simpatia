import { Request, Response } from 'express';
import * as pausaExcecaoService from '../services/pausa-excecao.service';

export const handleListByClinica = async (req: Request, res: Response) => {
  try {
    const { clinicaId } = req.user!;
    const { startDate, endDate } = req.query;

    const excecoes = await pausaExcecaoService.listByClinica(
      clinicaId!,
      startDate as string,
      endDate as string
    );

    res.json(excecoes);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Erro ao buscar exceções de pausa' });
  }
};

export const handleListByDoutor = async (req: Request, res: Response) => {
  try {
    const doutorId = parseInt(req.params.doutorId);
    const { startDate, endDate } = req.query;

    const excecoes = await pausaExcecaoService.listByDoutor(
      doutorId,
      startDate as string,
      endDate as string
    );

    res.json(excecoes);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Erro ao buscar exceções de pausa' });
  }
};

export const handleCreate = async (req: Request, res: Response) => {
  try {
    const { clinicaId, id, role } = req.user!;
    const { data, pausaInicio, pausaFim, doutorId } = req.body;

    // Validar campos obrigatórios
    if (!data || !pausaInicio || !pausaFim) {
      return res.status(400).json({ message: 'Data, pausaInicio e pausaFim são obrigatórios' });
    }

    const createData: pausaExcecaoService.ICreatePausaExcecao = {
      data,
      pausaInicio,
      pausaFim,
    };

    // Se doutorId foi fornecido, é exceção de doutor
    if (doutorId) {
      createData.doutorId = doutorId;
      createData.clinicaId = undefined;
    } else {
      // Senão, é exceção de clínica
      createData.clinicaId = clinicaId;
      createData.doutorId = undefined;
    }

    const excecao = await pausaExcecaoService.create(createData);

    res.status(201).json(excecao);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Erro ao criar exceção de pausa' });
  }
};

export const handleUpdate = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { pausaInicio, pausaFim } = req.body;

    const excecao = await pausaExcecaoService.update(id, {
      pausaInicio,
      pausaFim,
    });

    res.json(excecao);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Erro ao atualizar exceção de pausa' });
  }
};

export const handleDelete = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    await pausaExcecaoService.remove(id);

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Erro ao excluir exceção de pausa' });
  }
};

