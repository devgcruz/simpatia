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
            const { 
                nome, 
                telefone, 
                cpf,
                dataNascimento,
                genero,
                email,
                cep,
                logradouro,
                numero,
                bairro,
                cidade,
                estado,
                convenio,
                numeroCarteirinha,
                alergias,
                observacoes,
                doutorId 
            } = req.body;

            const { clinicaId, role, id: userId } = req.user!;

            // Se o usuário for DOUTOR, vincular automaticamente ao doutor logado
            const doutorIdFinal = role === 'DOUTOR' ? userId : (doutorId ? Number(doutorId) : undefined);

            const novoPaciente = await pacienteService.create({
                nome,
                telefone,
                cpf,
                dataNascimento,
                genero,
                email,
                cep,
                logradouro,
                numero,
                bairro,
                cidade,
                estado,
                convenio,
                numeroCarteirinha,
                alergias,
                observacoes,
                doutorId: doutorIdFinal,
            }, clinicaId);

            return res.status(201).json(novoPaciente);

        } catch (error: any) {

            if (error.message.includes("telefone") || error.message.includes("CPF")) {
                return res.status(409).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });

        }

    }

    async handleUpdate(req: Request, res: Response) {

        try {
            const id = Number(req.params.id);
            const data = req.body;

            const { clinicaId, role, id: userId } = req.user!;

            // Se o usuário for DOUTOR, garantir que o doutorId não seja alterado ou seja o próprio doutor
            if (role === 'DOUTOR') {
                // Remover doutorId do body se estiver presente - DOUTOR não pode alterar
                const { doutorId, ...dataSemDoutorId } = data;
                // Forçar o doutorId a ser o ID do doutor logado
                const dataFinal = {
                    ...dataSemDoutorId,
                    doutorId: userId,
                };
                const pacienteAtualizado = await pacienteService.update(id, dataFinal, clinicaId);
                return res.status(200).json(pacienteAtualizado);
            }

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

    async handleUpdateHistorico(req: Request, res: Response) {
        try {
            const historicoId = Number(req.params.historicoId);
            const { descricao } = req.body;

            const { clinicaId } = req.user!;

            const historicoAtualizado = await pacienteService.updateHistorico(historicoId, descricao, clinicaId);
            return res.status(200).json(historicoAtualizado);
        } catch (error: any) {
            if (error.message === "Histórico não encontrado." || error.message === "Histórico não pertence a esta clínica.") {
                return res.status(404).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }


}

export default new PacienteController();