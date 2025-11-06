import { Request, Response } from 'express';
import pacienteService from '../services/pacientes.service';

class PacienteController {

    async handleGetAll(req: Request, res: Response) {
        try {
            const paciente = await pacienteService.getAll();
            return res.status(200).json(paciente);
        } catch (error: any) {
            return res.status(500).json({ message: error.message })
        }
    }

    async handleGetById(req: Request, res: Response) {

        try {
            const id = Number(req.params.id);

            const paciente = await pacienteService.getById(id);
            return res.status(200).json(paciente);
        } catch (error: any) {

            if (error.message === "Paciente não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });

        }
    }

    async handleCreate(req: Request, res: Response) {

        try {
            const { nome, telefone } = req.body;

            const novoPaciente = await pacienteService.create({
                nome,
                telefone
            });

            return res.status(201).json(novoPaciente);

        } catch (error: any) {

            if (error.message.includes("telefone")) {
                return res.status(409).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });

        }

    }

    async handleUpdate(req: Request, res: Response) {

        try {
            const id = Number(req.params.id);
            const data = req.body;

            const pacienteAtualizado = await pacienteService.update(id, data);
            return res.status(200).json(pacienteAtualizado);

        } catch (error: any) {

            if (error.message === "Paciente não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });

        }

    }

    async handleDelete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            await pacienteService.delete(id);
            return res.status(204).send();

        } catch (error: any) {
            if (error.message === "Paciente não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message })
        }
    }


}

export default new PacienteController();