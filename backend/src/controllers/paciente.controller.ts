import { Request, Response } from 'express';
import pacienteService from '../services/pacientes.service';

class PacienteController {

    async handleGetAll(req: Request, res: Response) {
        try {
            const { clinicaId } = req.user!;
            const paciente = await pacienteService.getAll(clinicaId);
            return res.status(200).json(paciente);
        } catch (error: any) {
            return res.status(500).json({ message: error.message })
        }
    }

    async handleGetById(req: Request, res: Response) {

        try {
            const id = Number(req.params.id);

            const { clinicaId } = req.user!;

            const paciente = await pacienteService.getById(id, clinicaId);
            return res.status(200).json(paciente);
        } catch (error: any) {

            if (error.message === "Paciente não encontrado." || error.message === "Paciente não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });

        }
    }

    async handleGetHistoricos(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const { clinicaId } = req.user!;

            const historicos = await pacienteService.getHistoricos(id, clinicaId);
            return res.status(200).json(historicos);
        } catch (error: any) {
            if (error.message === "Paciente não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }

    async handleCreate(req: Request, res: Response) {

        try {
            const { nome, telefone } = req.body;

            const { clinicaId } = req.user!;

            const novoPaciente = await pacienteService.create({
                nome,
                telefone,
            }, clinicaId);

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

            const { clinicaId } = req.user!;

            const pacienteAtualizado = await pacienteService.update(id, data, clinicaId);
            return res.status(200).json(pacienteAtualizado);

        } catch (error: any) {

            if (error.message === "Paciente não encontrado." || error.message === "Paciente não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });

        }

    }

    async handleDelete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const { clinicaId } = req.user!;

            await pacienteService.delete(id, clinicaId);
            return res.status(204).send();

        } catch (error: any) {
            if (error.message === "Paciente não encontrado." || error.message === "Paciente não encontrado ou não pertence à esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message })
        }
    }


}

export default new PacienteController();