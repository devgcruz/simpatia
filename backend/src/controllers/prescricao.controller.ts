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
}

export default new PrescricaoController();


