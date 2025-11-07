import { Request, Response } from 'express';
import servicoService from '../services/servicos.service';

class ServicosController {
    async handleGetAll(req: Request, res: Response) {
        try {
            const { clinicaId } = req.user!;
            const servicos = await servicoService.getAll(clinicaId);
            return res.status(200).json(servicos);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetById(req: Request, res: Response) {

        try {
            const id = Number(req.params.id);

            const { clinicaId } = req.user!;
            const servico = await servicoService.getById(id, clinicaId);
            return res.status(200).json(servico);

        } catch (error: any) {

            if (error.message === "Serviço não encontrado." || error.message === "Serviço não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }
            return res.status(500).json({ message: error.message });
        }
    }

    async handleCreate(req: Request, res: Response) {
        try {
            const { nome, descricao, duracaoMin, preco } = req.body;

            const { clinicaId } = req.user!;

            const novoServico = await servicoService.create({
                nome,
                descricao,
                duracaoMin,
                preco,
            }, clinicaId);

            return res.status(201).json(novoServico);

        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    async handleUpdate(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const data = req.body;

            const { clinicaId } = req.user!;

            const servicoAtualizado = await servicoService.update(id, data, clinicaId);
            return res.status(200).json(servicoAtualizado);
        } catch (error: any) {
            if (error.message === "Serviço não encontrado." || error.message === "Serviço não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleDelete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const { clinicaId } = req.user!;

            await servicoService.delete(id, clinicaId);

            return res.status(204).send();
        } catch (error: any) {
            if (error.message === "Serviço não encontrado." || error.message === "Serviço não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }
}

export default new ServicosController();