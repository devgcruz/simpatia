import { Request, Response } from 'express';
import secretariaService from '../services/secretaria.service';
import bcrypt from 'bcryptjs';

class SecretariaController {
  async handleGetAll(req: Request, res: Response) {
    try {
      const { clinicaId } = req.user!;

      if (!clinicaId) {
        return res.status(403).json({ message: 'Clínica não identificada.' });
      }

      const secretarias = await secretariaService.getAll(clinicaId);
      return res.status(200).json(secretarias);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  async handleGetById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { clinicaId } = req.user!;

      if (!clinicaId) {
        return res.status(403).json({ message: 'Clínica não identificada.' });
      }

      const secretaria = await secretariaService.getById(id, clinicaId);
      return res.status(200).json(secretaria);
    } catch (error: any) {
      if (error.message === 'Secretária não encontrada.') {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  }

  async handleCreate(req: Request, res: Response) {
    try {
      const { nome, email, senha, doutorIds } = req.body;
      const { clinicaId } = req.user!;

      if (!clinicaId) {
        return res.status(403).json({ message: 'Clínica não identificada.' });
      }

      if (!nome || !email || !senha) {
        return res.status(400).json({ message: 'Nome, email e senha são obrigatórios.' });
      }

      // Hash da senha
      const senhaHash = await bcrypt.hash(senha, 10);

      const novaSecretaria = await secretariaService.create({
        nome,
        email,
        senha: senhaHash,
        clinicaId,
        doutorIds: doutorIds || [],
      });

      return res.status(201).json(novaSecretaria);
    } catch (error: any) {
      if (error.message.includes('já cadastrado') || error.message.includes('não pertence')) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  }

  async handleUpdate(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { nome, email, senha, doutorIds } = req.body;
      const { clinicaId } = req.user!;

      if (!clinicaId) {
        return res.status(403).json({ message: 'Clínica não identificada.' });
      }

      const updateData: any = {};
      if (nome) updateData.nome = nome;
      if (email) updateData.email = email;
      if (senha) {
        updateData.senha = await bcrypt.hash(senha, 10);
      }
      if (doutorIds !== undefined) {
        updateData.doutorIds = doutorIds;
      }

      const secretariaAtualizada = await secretariaService.update(id, updateData, clinicaId);
      return res.status(200).json(secretariaAtualizada);
    } catch (error: any) {
      if (error.message === 'Secretária não encontrada.') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('já cadastrado') || error.message.includes('não pertence')) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  }

  async handleDelete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { clinicaId } = req.user!;

      if (!clinicaId) {
        return res.status(403).json({ message: 'Clínica não identificada.' });
      }

      await secretariaService.delete(id, clinicaId);
      return res.status(204).send();
    } catch (error: any) {
      if (error.message === 'Secretária não encontrada.') {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  }
}

export default new SecretariaController();


