import { Request, Response } from 'express';
import agendamentoService from '../services/agendamento.service';
import { emitAgendamentoEvent } from '../services/websocket.service';

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
            const { dataHora, status, pacienteId, doutorId, servicoId, isEncaixe } = req.body;

            const user = req.user!;

            const novoAgendamento = await agendamentoService.create({
                dataHora,
                status,
                pacienteId,
                doutorId,
                servicoId,
                isEncaixe,
            }, user);

            // Emitir evento WebSocket para atualização em tempo real
            // Garantir que temos o doutorId (pode estar em novoAgendamento.doutorId ou novoAgendamento.doutor.id)
            const agendamentoDoutorId = novoAgendamento.doutorId || novoAgendamento.doutor?.id;
            const agendamentoClinicaId = user.clinicaId || novoAgendamento.doutor?.clinicaId || novoAgendamento.paciente?.clinicaId;
            
            console.log(`[Agendamento Controller] Emitindo evento WebSocket: agendamentoId=${novoAgendamento.id}, doutorId=${agendamentoDoutorId}, clinicaId=${agendamentoClinicaId}`);
            
            emitAgendamentoEvent({
                id: novoAgendamento.id,
                doutorId: agendamentoDoutorId,
                clinicaId: agendamentoClinicaId,
                action: 'created',
                agendamento: novoAgendamento,
            });

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
            
            // Emitir evento WebSocket para atualização em tempo real
            const action = data.status === 'cancelado' ? 'updated' : 'updated';
            emitAgendamentoEvent({
                id: agendamentoAtualizado.id,
                doutorId: agendamentoAtualizado.doutorId,
                clinicaId: user.clinicaId,
                action,
                agendamento: agendamentoAtualizado,
            });

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
            
            // Emitir evento WebSocket para atualização em tempo real
            emitAgendamentoEvent({
                id: agendamentoFinalizado.id,
                doutorId: agendamentoFinalizado.doutorId,
                clinicaId: user.clinicaId,
                action: 'finalized',
                agendamento: agendamentoFinalizado,
            });

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

    async handleConfirmarEncaixe(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const user = req.user!;

            const agendamentoConfirmado = await agendamentoService.confirmarEncaixe(id, user);
            
            // Emitir evento WebSocket para atualização em tempo real
            emitAgendamentoEvent({
                id: agendamentoConfirmado.id,
                doutorId: agendamentoConfirmado.doutorId,
                clinicaId: user.clinicaId,
                action: 'encaixe_confirmed',
                agendamento: agendamentoConfirmado,
            });

            return res.status(200).json(agendamentoConfirmado);

        } catch (error: any) {
            if (error.message === "Agendamento não encontrado.") {
                return res.status(404).json({ message: error.message });
            }

            if (error.message === "Acesso negado." || error.message.includes("Acesso negado")) {
                return res.status(403).json({ message: error.message });
            }

            return res.status(400).json({ message: error.message });
        }
    }

    async handleDelete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            const user = req.user!;

            // Buscar agendamento antes de deletar para emitir evento
            const agendamentoParaDeletar = await agendamentoService.getById(id, user);
            
            await agendamentoService.delete(id, user);
            
            // Emitir evento WebSocket para atualização em tempo real
            emitAgendamentoEvent({
                id: agendamentoParaDeletar.id,
                doutorId: agendamentoParaDeletar.doutorId,
                clinicaId: user.clinicaId,
                action: 'deleted',
                agendamento: null,
            });

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

