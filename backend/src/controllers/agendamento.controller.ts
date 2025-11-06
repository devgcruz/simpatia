import { Request, Response } from 'express';
import agendamentoService from '../services/agendamento.service';

class AgendamentoController {

    async handleGetAll(req: Request, res: Response) {
        try {
            // Ler filtros da query string
            const filtros: any = {};

            if (req.query.doutorId) {
                filtros.doutorId = Number(req.query.doutorId);
            }

            if (req.query.dataInicio) {
                filtros.dataInicio = new Date(req.query.dataInicio as string);
            }

            if (req.query.dataFim) {
                filtros.dataFim = new Date(req.query.dataFim as string);
            }

            const agendamentos = await agendamentoService.getAll(filtros);
            return res.status(200).json(agendamentos);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetById(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const agendamento = await agendamentoService.getById(id);
            return res.status(200).json(agendamento);
        } catch (error: any) {
            if (error.message === "Agendamento não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }

    async handleCreate(req: Request, res: Response) {
        try {
            const { dataHora, status, pacienteId, doutorId, servicoId } = req.body;

            const novoAgendamento = await agendamentoService.create({
                dataHora,
                status,
                pacienteId,
                doutorId,
                servicoId
            });

            return res.status(201).json(novoAgendamento);

        } catch (error: any) {
            if (error.message.includes("não encontrado")) {
                return res.status(404).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleUpdate(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const data = req.body;

            const agendamentoAtualizado = await agendamentoService.update(id, data);
            return res.status(200).json(agendamentoAtualizado);

        } catch (error: any) {
            if (error.message === "Agendamento não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message.includes("não encontrado")) {
                return res.status(404).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleDelete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            await agendamentoService.delete(id);
            return res.status(204).send();

        } catch (error: any) {
            if (error.message === "Agendamento não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }
}

export default new AgendamentoController();

