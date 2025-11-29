import { Request, Response } from 'express';
import indisponibilidadeService from '../services/indisponibilidade.service';

class IndisponibilidadeController {
  async handleListByClinica(req: Request, res: Response) {
    try {
      const { clinicaId } = req.user!;
      const itens = await indisponibilidadeService.listByClinica(clinicaId!);
      return res.status(200).json(itens);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  async handleListByDoutor(req: Request, res: Response) {
    try {
      const doutorId = Number(req.params.doutorId);
      const itens = await indisponibilidadeService.listByDoutor(doutorId);
      return res.status(200).json(itens);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  async handleCreate(req: Request, res: Response) {
    try {
      const { clinicaId } = req.user!;
      const ignorarConflitos = req.query.ignorarConflitos === 'true' || req.body.ignorarConflitos === true;
      
      const created = await indisponibilidadeService.create(
        req.body,
        { clinicaId: clinicaId! },
        { ignorarConflitos }
      );
      
      return res.status(201).json(created);
    } catch (error: any) {
      // Tratar erro de conflito com agendamentos
      if (error.code === 'CONFLITO_AGENDAMENTOS') {
        return res.status(409).json({
          message: error.message,
          code: error.code,
          agendamentosConflitantes: error.agendamentosConflitantes,
          sugestoesReagendamento: error.sugestoesReagendamento,
        });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async handleUpdate(req: Request, res: Response) {
    try {
      const { clinicaId } = req.user!;
      const id = Number(req.params.id);
      const ignorarConflitos = req.query.ignorarConflitos === 'true' || req.body.ignorarConflitos === true;
      
      const updated = await indisponibilidadeService.update(
        id,
        req.body,
        { clinicaId: clinicaId! },
        { ignorarConflitos }
      );
      
      return res.status(200).json(updated);
    } catch (error: any) {
      if (error.message?.includes('não encontrada')) {
        return res.status(404).json({ message: error.message });
      }
      // Tratar erro de conflito com agendamentos
      if (error.code === 'CONFLITO_AGENDAMENTOS') {
        return res.status(409).json({
          message: error.message,
          code: error.code,
          agendamentosConflitantes: error.agendamentosConflitantes,
          sugestoesReagendamento: error.sugestoesReagendamento,
        });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async handleDelete(req: Request, res: Response) {
    try {
      const { clinicaId } = req.user!;
      const id = Number(req.params.id);
      await indisponibilidadeService.delete(id, { clinicaId: clinicaId! });
      return res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes('não encontrada')) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }
}

export default new IndisponibilidadeController();


