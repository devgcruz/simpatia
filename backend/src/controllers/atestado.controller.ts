import { Request, Response } from 'express';
import atestadoService from '../services/atestado.service';

class AtestadoController {
  async create(req: Request, res: Response) {
    try {
      const { diasAfastamento, cid, exibirCid, conteudo, localAtendimento, dataAtestado, pacienteId, doutorId, agendamentoId } = req.body;

      if (!diasAfastamento || !pacienteId || !doutorId) {
        return res.status(400).json({ error: 'Dados obrigatórios faltando' });
      }

      const atestado = await atestadoService.create({
        diasAfastamento,
        cid,
        exibirCid: exibirCid || false,
        conteudo: conteudo || '',
        localAtendimento: localAtendimento || 'Consultório',
        dataAtestado: dataAtestado || undefined,
        pacienteId,
        doutorId,
        agendamentoId,
      });

      return res.status(201).json(atestado);
    } catch (error) {
      console.error('Erro ao criar atestado:', error);
      return res.status(500).json({ error: 'Erro ao criar atestado' });
    }
  }

  async findByPaciente(req: Request, res: Response) {
    try {
      const { pacienteId } = req.params;

      const atestados = await atestadoService.findByPaciente(Number(pacienteId));

      return res.json(atestados);
    } catch (error) {
      console.error('Erro ao buscar atestados:', error);
      return res.status(500).json({ error: 'Erro ao buscar atestados' });
    }
  }

  async findByProtocolo(req: Request, res: Response) {
    try {
      const { protocolo } = req.params;

      const atestado = await atestadoService.findByProtocolo(protocolo);

      if (!atestado) {
        return res.status(404).json({ error: 'Atestado não encontrado' });
      }

      return res.json(atestado);
    } catch (error) {
      console.error('Erro ao buscar atestado:', error);
      return res.status(500).json({ error: 'Erro ao buscar atestado' });
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

      const result = await atestadoService.getAll(filters);
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao buscar atestados:', error);
      return res.status(500).json({ error: error.message || 'Erro ao buscar atestados' });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const atestado = await atestadoService.getById(Number(id));
      return res.json(atestado);
    } catch (error: any) {
      console.error('Erro ao buscar atestado:', error);
      return res.status(404).json({ error: error.message || 'Atestado não encontrado' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { diasAfastamento, cid, exibirCid, conteudo, localAtendimento, dataAtestado } = req.body;

      const updateData: any = {};
      if (diasAfastamento !== undefined) updateData.diasAfastamento = diasAfastamento;
      if (cid !== undefined) updateData.cid = cid;
      if (exibirCid !== undefined) updateData.exibirCid = exibirCid;
      if (conteudo !== undefined) updateData.conteudo = conteudo;
      if (localAtendimento !== undefined) updateData.localAtendimento = localAtendimento;
      if (dataAtestado !== undefined) updateData.dataAtestado = dataAtestado;

      const atestado = await atestadoService.update(Number(id), updateData);
      return res.json(atestado);
    } catch (error: any) {
      console.error('Erro ao atualizar atestado:', error);
      return res.status(500).json({ error: error.message || 'Erro ao atualizar atestado' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await atestadoService.delete(Number(id));
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao deletar atestado:', error);
      return res.status(500).json({ error: error.message || 'Erro ao deletar atestado' });
    }
  }
}

export default new AtestadoController();

