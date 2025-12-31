import { Request, Response } from 'express';
import servicoService from '../services/servicos.service';

class ServicosController {
    async handleGetAll(req: Request, res: Response) {
        try {
            const user = req.user!;
            const { clinicaId } = user;
            // NUNCA confiar em doutorId da query para médicos - sempre usar do token
            // Removido: const { doutorId } = req.query;
            const servicos = await servicoService.getAll(clinicaId!, undefined, user);
            return res.status(200).json(servicos);
        } catch (error: any) {
            if (error.message.includes('Acesso negado')) {
                return res.status(403).json({ message: error.message });
            }
            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetByDoutor(req: Request, res: Response) {
        try {
            const user = req.user!;
            const { clinicaId } = user;
            // NUNCA confiar em doutorId da URL para médicos - sempre usar do token
            const doutorId = Number(req.params.doutorId);
            const servicos = await servicoService.getByDoutor(doutorId, clinicaId!, user);
            return res.status(200).json(servicos);
        } catch (error: any) {
            if (error.message.includes('Acesso negado')) {
                return res.status(403).json({ message: error.message });
            }
            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetById(req: Request, res: Response) {

        try {
            const user = req.user!;
            const id = Number(req.params.id);

            const { clinicaId } = user;
            const servico = await servicoService.getById(id, clinicaId!, user);
            return res.status(200).json(servico);

        } catch (error: any) {
            if (error.message.includes('Acesso negado')) {
                return res.status(403).json({ message: error.message });
            }
            if (error.message === "Serviço não encontrado." || error.message === "Serviço não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }
            return res.status(500).json({ message: error.message });
        }
    }

    async handleCreate(req: Request, res: Response) {
        try {
            const user = req.user!;
            const { nome, descricao, duracaoMin, preco, doutorId } = req.body;

            const { clinicaId } = user;

            // Para médicos, o doutorId será forçado automaticamente no service
            // Para não-médicos (CLINICA_ADMIN, SECRETARIA), doutorId é obrigatório
            const isDoctor = user.role === 'DOUTOR' || (user as any).doutorId !== undefined;
            if (!isDoctor && !doutorId) {
                return res.status(400).json({ message: "doutorId é obrigatório." });
            }

            const novoServico = await servicoService.create({
                nome,
                descricao,
                duracaoMin,
                preco,
                doutorId: doutorId || undefined, // Será forçado no service se for médico
            }, clinicaId!, user);

            return res.status(201).json(novoServico);

        } catch (error: any) {
            if (error.message.includes('Acesso negado')) {
                return res.status(403).json({ message: error.message });
            }
            return res.status(400).json({ message: error.message });
        }
    }

    async handleUpdate(req: Request, res: Response) {
        try {
            const user = req.user!;
            const id = Number(req.params.id);

            const data = req.body;

            const { clinicaId } = user;

            const servicoAtualizado = await servicoService.update(id, data, clinicaId!, user);
            return res.status(200).json(servicoAtualizado);
        } catch (error: any) {
            if (error.message.includes('Acesso negado')) {
                return res.status(403).json({ message: error.message });
            }
            if (error.message === "Serviço não encontrado." || error.message === "Serviço não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleDelete(req: Request, res: Response) {
        try {
            const user = req.user!;
            const id = Number(req.params.id);

            const { clinicaId } = user;

            await servicoService.delete(id, clinicaId!, user);

            return res.status(204).send();
        } catch (error: any) {
            if (error.message.includes('Acesso negado')) {
                return res.status(403).json({ message: error.message });
            }
            if (error.message === "Serviço não encontrado." || error.message === "Serviço não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }
}

export default new ServicosController();