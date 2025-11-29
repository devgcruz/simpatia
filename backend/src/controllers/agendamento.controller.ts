import { Request, Response } from 'express';
import agendamentoService from '../services/agendamento.service';

class AgendamentoController {

    async handleGetAll(req: Request, res: Response) {
        try {
            const user = req.user!;
            const filtros = {
                doutorId: req.query.doutorId as string | undefined,
                dataInicio: req.query.dataInicio as string | undefined,
                dataFim: req.query.dataFim as string | undefined,
            };

            const agendamentos = await agendamentoService.getAll(user, filtros);
            return res.status(200).json(agendamentos);
        } catch (error: any) {
            if (error.message === "Acesso negado.") {
                return res.status(403).json({ message: error.message });
            }
            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetById(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const user = req.user!;

            const agendamento = await agendamentoService.getById(id, user);
            return res.status(200).json(agendamento);
        } catch (error: any) {
            if (error.message === "Agendamento não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message === "Acesso negado.") {
                return res.status(403).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }

    async handleCreate(req: Request, res: Response) {
        try {
            const { dataHora, status, pacienteId, doutorId, servicoId } = req.body;

            const user = req.user!;

            const novoAgendamento = await agendamentoService.create({
                dataHora,
                status,
                pacienteId,
                doutorId,
                servicoId,
            }, user);

            return res.status(201).json(novoAgendamento);

        } catch (error: any) {
            if (error.message.includes("não encontrado")) {
                return res.status(404).json({ message: error.message });
            }

            if (error.message === "Acesso negado.") {
                return res.status(403).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleUpdate(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const data = req.body;

            const user = req.user!;

            const agendamentoAtualizado = await agendamentoService.update(id, data, user);
            return res.status(200).json(agendamentoAtualizado);

        } catch (error: any) {
            if (error.message === "Agendamento não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message.includes("não encontrado")) {
                return res.status(404).json({ message: error.message });
            }

            if (error.message === "Acesso negado.") {
                return res.status(403).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleFinalize(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const { descricao, duracaoMinutos } = req.body;
            const user = req.user!;

            // Converter duracaoMinutos para número ou undefined
            const duracaoMinutosNumber = duracaoMinutos !== undefined && duracaoMinutos !== null 
                ? Number(duracaoMinutos) 
                : undefined;

            const agendamentoFinalizado = await agendamentoService.finalize(id, descricao, duracaoMinutosNumber, user);
            return res.status(200).json(agendamentoFinalizado);
        } catch (error: any) {
            if (error.message === "Agendamento não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message === "Acesso negado.") {
                return res.status(403).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleDelete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const user = req.user!;

            await agendamentoService.delete(id, user);
            return res.status(204).send();

        } catch (error: any) {
            if (error.message === "Agendamento não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message === "Acesso negado." || error.message.includes("Acesso negado")) {
                return res.status(403).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }
}

export default new AgendamentoController();

