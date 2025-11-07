import { Request, Response } from 'express';
import doutorService from '../services/doutor.service';

// Função auxiliar para remover a senha do objeto
const removeSenha = (doutor: any) => {
    const { senha, ...doutorSemSenha } = doutor;
    return doutorSemSenha;
};

class DoutorController {

    async handleGetAll(req: Request, res: Response) {
        try {
            const { role, clinicaId } = req.user!;

            if (role !== 'CLINICA_ADMIN' && role !== 'SUPER_ADMIN') {
                return res.status(403).json({ message: 'Acesso negado. Permissão insuficiente.' });
            }

            const doutores = await doutorService.getAll(clinicaId);
            return res.status(200).json(doutores);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetById(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const { role, clinicaId } = req.user!;

            if (role !== 'CLINICA_ADMIN' && role !== 'SUPER_ADMIN') {
                return res.status(403).json({ message: 'Acesso negado. Permissão insuficiente.' });
            }

            const doutor = await doutorService.getById(id, clinicaId);
            return res.status(200).json(doutor);
        } catch (error: any) {
            if (error.message === "Doutor não encontrado." || error.message === "Doutor não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }

    async handleCreate(req: Request, res: Response) {
        try {
            const { role, clinicaId } = req.user!;

            if (role !== 'CLINICA_ADMIN' && role !== 'SUPER_ADMIN') {
                return res.status(403).json({ message: 'Acesso negado. Permissão insuficiente.' });
            }

            const { nome, email, senha, especialidade, role: novoRole } = req.body;

            const novoDoutor = await doutorService.create({
                nome,
                email,
                senha,
                especialidade,
                role: novoRole,
            }, clinicaId);

            return res.status(201).json(novoDoutor);

        } catch (error: any) {
            if (error.message.includes("email")) {
                return res.status(409).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleUpdate(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const data = req.body;

            const { role, clinicaId } = req.user!;

            if (role !== 'CLINICA_ADMIN' && role !== 'SUPER_ADMIN') {
                return res.status(403).json({ message: 'Acesso negado. Permissão insuficiente.' });
            }

            const doutorAtualizado = await doutorService.update(id, data, clinicaId);
            return res.status(200).json(doutorAtualizado);

        } catch (error: any) {
            if (error.message === "Doutor não encontrado." || error.message === "Doutor não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message.includes("email")) {
                return res.status(409).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleDelete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const { role, clinicaId } = req.user!;

            if (role !== 'CLINICA_ADMIN' && role !== 'SUPER_ADMIN') {
                return res.status(403).json({ message: 'Acesso negado. Permissão insuficiente.' });
            }

            await doutorService.delete(id, clinicaId);
            return res.status(204).send();

        } catch (error: any) {
            if (error.message === "Doutor não encontrado." || error.message === "Doutor não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }
}

export default new DoutorController();

