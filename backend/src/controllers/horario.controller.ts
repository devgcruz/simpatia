import { Request, Response } from 'express';
import horarioService from '../services/horario.service';

class HorarioController {

    async handleGetAll(req: Request, res: Response) {
        try {
            const user = req.user!;
            const horarios = await horarioService.getAll(user);
            return res.status(200).json(horarios);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetById(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const user = req.user!;

            const horario = await horarioService.getById(id, user);
            return res.status(200).json(horario);
        } catch (error: any) {
            if (error.message === "Horário não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message === "Acesso negado.") {
                return res.status(403).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetByDoutorId(req: Request, res: Response) {
        try {
            const doutorId = Number(req.params.doutorId);

            const user = req.user!;

            const horarios = await horarioService.getByDoutorId(doutorId, user);
            return res.status(200).json(horarios);
        } catch (error: any) {
            if (error.message === "Doutor não encontrado ou não pertence à esta clínica.") {
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
            const { diaSemana, inicio, fim, pausaInicio, pausaFim, doutorId } = req.body;

            const user = req.user!;

            const novoHorario = await horarioService.create({
                diaSemana,
                inicio,
                fim,
                pausaInicio,
                pausaFim,
                doutorId
            }, user);

            return res.status(201).json(novoHorario);

        } catch (error: any) {
            if (error.message.includes("Doutor não encontrado")) {
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

            const horarioAtualizado = await horarioService.update(id, data, user);
            return res.status(200).json(horarioAtualizado);

        } catch (error: any) {
            if (error.message === "Horário não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message.includes("Doutor não encontrado")) {
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

            await horarioService.delete(id, user);
            return res.status(204).send();

        } catch (error: any) {
            if (error.message === "Horário não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message === "Acesso negado.") {
                return res.status(403).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }
}

export default new HorarioController();

