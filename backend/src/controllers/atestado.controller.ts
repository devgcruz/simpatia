import { Request, Response } from 'express';
import atestadoService from '../services/atestado.service';

class AtestadoController {
  async create(req: Request, res: Response) {
    try {
      const { diasAfastamento, horaInicial, horaFinal, cid, exibirCid, conteudo, localAtendimento, dataAtestado, pacienteId, doutorId, agendamentoId } = req.body;

      if (!diasAfastamento || !pacienteId || !doutorId) {
        return res.status(400).json({ error: 'Dados obrigatórios faltando' });
      }

      const atestado = await atestadoService.create({
        diasAfastamento,
        horaInicial: horaInicial || undefined,
        horaFinal: horaFinal || undefined,
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
      const user = req.user!; // User vem do middleware de autenticação
      const { pacienteId } = req.params;

      const atestados = await atestadoService.findByPaciente(Number(pacienteId), user);

      return res.json(atestados);
    } catch (error: any) {
      console.error('Erro ao buscar atestados:', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro ao buscar atestados' });
    }
  }

  async findByProtocolo(req: Request, res: Response) {
    try {
      const user = req.user!; // User vem do middleware de autenticação
      const { protocolo } = req.params;

      const atestado = await atestadoService.findByProtocolo(protocolo, user);

      if (!atestado) {
        return res.status(404).json({ error: 'Atestado não encontrado' });
      }

      return res.json(atestado);
    } catch (error: any) {
      console.error('Erro ao buscar atestado:', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro ao buscar atestado' });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const user = req.user!; // User vem do middleware de autenticação
      const { pacienteId, agendamentoId, skip, take } = req.query;

      const filters: any = {};
      if (pacienteId) filters.pacienteId = Number(pacienteId);
      // NUNCA confiar em doutorId da query - sempre usar do token
      // Removido: if (doutorId) filters.doutorId = Number(doutorId);
      if (agendamentoId !== undefined) {
        filters.agendamentoId = agendamentoId === 'null' ? null : Number(agendamentoId);
      }
      if (skip) filters.skip = Number(skip);
      if (take) filters.take = Number(take);

      const result = await atestadoService.getAll(filters, user);
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao buscar atestados:', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro ao buscar atestados' });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const user = req.user!; // User vem do middleware de autenticação
      const { id } = req.params;
      const atestado = await atestadoService.getById(Number(id), user);
      return res.json(atestado);
    } catch (error: any) {
      console.error('Erro ao buscar atestado:', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(404).json({ error: error.message || 'Atestado não encontrado' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const user = req.user!; // User vem do middleware de autenticação
      const { id } = req.params;
      const { diasAfastamento, horaInicial, horaFinal, cid, exibirCid, conteudo, localAtendimento, dataAtestado } = req.body;

      const updateData: any = {};
      if (diasAfastamento !== undefined) updateData.diasAfastamento = diasAfastamento;
      if (horaInicial !== undefined) updateData.horaInicial = horaInicial;
      if (horaFinal !== undefined) updateData.horaFinal = horaFinal;
      if (cid !== undefined) updateData.cid = cid;
      if (exibirCid !== undefined) updateData.exibirCid = exibirCid;
      if (conteudo !== undefined) updateData.conteudo = conteudo;
      if (localAtendimento !== undefined) updateData.localAtendimento = localAtendimento;
      if (dataAtestado !== undefined) updateData.dataAtestado = dataAtestado;

      const atestado = await atestadoService.update(Number(id), updateData, user);
      return res.json(atestado);
    } catch (error: any) {
      console.error('Erro ao atualizar atestado:', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro ao atualizar atestado' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const user = req.user!; // User vem do middleware de autenticação
      const { id } = req.params;
      const result = await atestadoService.delete(Number(id), user);
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao deletar atestado:', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro ao deletar atestado' });
    }
  }

  async invalidate(req: Request, res: Response) {
    try {
      const user = req.user!; // User vem do middleware de autenticação
      const { id } = req.params;
      const { motivoInvalidacao } = req.body;

      if (!motivoInvalidacao || motivoInvalidacao.trim() === '') {
        return res.status(400).json({ error: 'Motivo da invalidação é obrigatório' });
      }

      const atestado = await atestadoService.invalidate(Number(id), motivoInvalidacao.trim(), user);
      return res.json(atestado);
    } catch (error: any) {
      console.error('Erro ao invalidar atestado:', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro ao invalidar atestado' });
    }
  }
}

export default new AtestadoController();

