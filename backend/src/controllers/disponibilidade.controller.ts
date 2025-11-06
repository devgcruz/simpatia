import { Request, Response } from 'express';
import disponibilidadeService from '../services/disponibilidade.service';

class DisponibilidadeController {

    async handleGetDisponibilidade(req: Request, res: Response) {
        try {
            const doutorId = Number(req.query.doutorId);
            const servicoId = Number(req.query.servicoId);
            const data = req.query.data as string;

            if (!doutorId || !servicoId || !data) {
                return res.status(400).json({
                    message: "doutorId, servicoId e data são obrigatórios."
                });
            }

            const horariosDisponiveis = await disponibilidadeService.getDisponibilidade(
                doutorId,
                servicoId,
                data
            );

            return res.status(200).json(horariosDisponiveis);

        } catch (error: any) {
            if (error.message.includes("não encontrado")) {
                return res.status(404).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message });
        }
    }
}

export default new DisponibilidadeController();

