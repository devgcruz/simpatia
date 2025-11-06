import { Request, Response } from 'express';
import horarioService from '../services/horario.service';

class HorarioController {

    async handleGetAll(req: Request, res: Response) {
        try {
            const horarios = await horarioService.getAll();
            return res.status(200).json(horarios);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetById(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const horario = await horarioService.getById(id);
            return res.status(200).json(horario);
        } catch (error: any) {
            if (error.message === "Horário não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }

    async handleGetByDoutorId(req: Request, res: Response) {
        try {
            const doutorId = Number(req.params.doutorId);

            const horarios = await horarioService.getByDoutorId(doutorId);
            return res.status(200).json(horarios);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    async handleCreate(req: Request, res: Response) {
        try {
            const { diaSemana, inicio, fim, pausaInicio, pausaFim, doutorId } = req.body;

            const novoHorario = await horarioService.create({
                diaSemana,
                inicio,
                fim,
                pausaInicio,
                pausaFim,
                doutorId
            });

            return res.status(201).json(novoHorario);

        } catch (error: any) {
            if (error.message.includes("Doutor não encontrado")) {
                return res.status(404).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleUpdate(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const data = req.body;

            const horarioAtualizado = await horarioService.update(id, data);
            return res.status(200).json(horarioAtualizado);

        } catch (error: any) {
            if (error.message === "Horário não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message.includes("Doutor não encontrado")) {
                return res.status(404).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleDelete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            await horarioService.delete(id);
            return res.status(204).send();

        } catch (error: any) {
            if (error.message === "Horário não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }
}

export default new HorarioController();

