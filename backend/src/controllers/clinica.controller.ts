import { Request, Response } from 'express';
import clinicaService from '../services/clinica.service';

class ClinicaController {
  async handleGetAll(req: Request, res: Response) {
    try {
      const clinicas = await clinicaService.getAll();
      return res.status(200).json(clinicas);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  async handleGetById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const clinica = await clinicaService.getById(id);

      if (!clinica) {
        return res.status(404).json({ message: 'Clínica não encontrada' });
      }

      return res.status(200).json(clinica);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  async handleCreate(req: Request, res: Response) {
    try {
      const novaClinica = await clinicaService.createClinicaEAdmin(req.body);
      return res.status(201).json(novaClinica);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  async handleUpdate(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const clinica = await clinicaService.update(id, req.body);
      return res.status(200).json(clinica);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Clínica não encontrada' });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async handleDelete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await clinicaService.delete(id);
      return res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Clínica não encontrada' });
      }
      return res.status(400).json({ message: error.message });
    }
  }
}

export default new ClinicaController();

