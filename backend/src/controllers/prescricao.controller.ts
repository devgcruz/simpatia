import { Request, Response } from 'express';
import prescricaoService from '../services/prescricao.service';

class PrescricaoController {
  async create(req: Request, res: Response) {
    try {
      const { conteudo, pacienteId, doutorId, agendamentoId } = req.body;

      if (!conteudo || !pacienteId || !doutorId) {
        return res.status(400).json({ error: 'Dados obrigatórios faltando' });
      }

      const prescricao = await prescricaoService.create({
        conteudo,
        pacienteId,
        doutorId,
        agendamentoId,
      });

      return res.status(201).json(prescricao);
    } catch (error) {
      console.error('Erro ao criar prescrição:', error);
      return res.status(500).json({ error: 'Erro ao criar prescrição' });
    }
  }

  async findByPaciente(req: Request, res: Response) {
    try {
      const { pacienteId } = req.params;

      const prescricoes = await prescricaoService.findByPaciente(Number(pacienteId));

      return res.json(prescricoes);
    } catch (error) {
      console.error('Erro ao buscar prescrições:', error);
      return res.status(500).json({ error: 'Erro ao buscar prescrições' });
    }
  }

  async findByProtocolo(req: Request, res: Response) {
    try {
      const { protocolo } = req.params;

      const prescricao = await prescricaoService.findByProtocolo(protocolo);

      if (!prescricao) {
        return res.status(404).json({ error: 'Prescrição não encontrada' });
      }

      return res.json(prescricao);
    } catch (error) {
      console.error('Erro ao buscar prescrição:', error);
      return res.status(500).json({ error: 'Erro ao buscar prescrição' });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { pacienteId, doutorId, agendamentoId, skip, take } = req.query;

      const filters: any = {};
      if (pacienteId) filters.pacienteId = Number(pacienteId);
      if (doutorId) filters.doutorId = Number(doutorId);
      if (agendamentoId !== undefined) {
        filters.agendamentoId = agendamentoId === 'null' ? null : Number(agendamentoId);
      }
      if (skip) filters.skip = Number(skip);
      if (take) filters.take = Number(take);

      const result = await prescricaoService.getAll(filters);
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao buscar prescrições:', error);
      return res.status(500).json({ error: error.message || 'Erro ao buscar prescrições' });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const prescricao = await prescricaoService.getById(Number(id));
      return res.json(prescricao);
    } catch (error: any) {
      console.error('Erro ao buscar prescrição:', error);
      return res.status(404).json({ error: error.message || 'Prescrição não encontrada' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { conteudo } = req.body;

      if (!conteudo) {
        return res.status(400).json({ error: 'Conteúdo é obrigatório' });
      }

      const prescricao = await prescricaoService.update(Number(id), { conteudo });
      return res.json(prescricao);
    } catch (error: any) {
      console.error('Erro ao atualizar prescrição:', error);
      return res.status(500).json({ error: error.message || 'Erro ao atualizar prescrição' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await prescricaoService.delete(Number(id));
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao deletar prescrição:', error);
      return res.status(500).json({ error: error.message || 'Erro ao deletar prescrição' });
    }
  }

  async invalidate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { motivoInvalidacao } = req.body;

      if (!motivoInvalidacao || motivoInvalidacao.trim() === '') {
        return res.status(400).json({ error: 'Motivo da invalidação é obrigatório' });
      }

      const prescricao = await prescricaoService.invalidate(Number(id), motivoInvalidacao.trim());
      return res.json(prescricao);
    } catch (error: any) {
      console.error('Erro ao invalidar prescrição:', error);
      return res.status(500).json({ error: error.message || 'Erro ao invalidar prescrição' });
    }
  }
}

export default new PrescricaoController();





