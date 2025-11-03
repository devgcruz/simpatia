import { Request, Response } from 'express';
import servicoService from '../services/servicos.service';

class ServicosController {
    async handleGetAll(req: Request, res: Response) {
        try {
            const servicos = await servicoService.getAll();
            return res.status(200).json(servicos);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetById(req: Request, res: Response) {

        try {
            const id = Number(req.params.id);

            const servico = await servicoService.getById(id);
            return res.status(200).json(servico);

        } catch (error: any) {

            if (error.message === "Serviço não encontrado.") {
                return res.status(404).json({ message: error.message });
            }
            return res.status(500).json({ message: error.message });
        }
    }

    async handleCreate(req: Request, res: Response) {
        try {
            const { nome, descricao, duracaoMin, preco } = req.body;

            const novoServico = await servicoService.create({
                nome,
                descricao,
                duracaoMin,
                preco
            });

            return res.status(201).json(novoServico);

        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    async handleUpdate(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const data = req.body;

            const servicoAtualizado = await servicoService.update(id, data);
            return res.status(200).json(servicoAtualizado);
        } catch (error: any) {
            if (error.message === "Serviço não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleDelete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            await servicoService.delete(id);

            return res.status(204).send();
        } catch (error: any) {
            if (error.message === "Serviço não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }
}

export default new ServicosController();