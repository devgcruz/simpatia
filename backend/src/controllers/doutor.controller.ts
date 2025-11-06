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
            const doutores = await doutorService.getAll();
            // Remover senha de todos os doutores
            const doutoresSemSenha = doutores.map(removeSenha);
            return res.status(200).json(doutoresSemSenha);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetById(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const doutor = await doutorService.getById(id);
            const doutorSemSenha = removeSenha(doutor);
            return res.status(200).json(doutorSemSenha);
        } catch (error: any) {
            if (error.message === "Doutor não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }

    async handleCreate(req: Request, res: Response) {
        try {
            const { nome, email, senha, clinicaId } = req.body;

            const novoDoutor = await doutorService.create({
                nome,
                email,
                senha,
                clinicaId
            });

            const doutorSemSenha = removeSenha(novoDoutor);
            return res.status(201).json(doutorSemSenha);

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

            const doutorAtualizado = await doutorService.update(id, data);
            const doutorSemSenha = removeSenha(doutorAtualizado);
            return res.status(200).json(doutorSemSenha);

        } catch (error: any) {
            if (error.message === "Doutor não encontrado.") {
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

            await doutorService.delete(id);
            return res.status(204).send();

        } catch (error: any) {
            if (error.message === "Doutor não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }
}

export default new DoutorController();

