import { Request, Response } from 'express';
import prontuarioChatService from '../services/prontuarioChat.service';

class ProntuarioChatController {
  async handleList(req: Request, res: Response) {
    try {
      const agendamentoId = Number(req.params.id);
      const user = req.user!;
      
      // SECRETARIA não pode acessar prontuário
      if (user.role === 'SECRETARIA') {
        return res.status(403).json({ message: 'Você não tem permissão para visualizar o prontuário do paciente.' });
      }
      
      const messages = await prontuarioChatService.listMessages(agendamentoId, user as any);
      return res.status(200).json(messages);
    } catch (error: any) {
      if (error.message === 'Agendamento não encontrado.') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Acesso negado.') {
        return res.status(403).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async handleSend(req: Request, res: Response) {
    try {
      const agendamentoId = Number(req.params.id);
      const { message } = req.body as { message?: string };
      const user = req.user!;

      // SECRETARIA não pode acessar prontuário
      if (user.role === 'SECRETARIA') {
        return res.status(403).json({ message: 'Você não tem permissão para acessar o prontuário do paciente.' });
      }

      if (!message || !message.trim()) {
        return res.status(400).json({ message: 'Mensagem obrigatória.' });
      }

      const messages = await prontuarioChatService.sendMessage(agendamentoId, message, user as any);
      return res.status(200).json({ messages });
    } catch (error: any) {
      if (error.message === 'Agendamento não encontrado.') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Acesso negado.') {
        return res.status(403).json({ message: error.message });
      }
      if (error.message === 'Mensagem obrigatória.' || error.message === 'GOOGLE_API_KEY não configurada no servidor.') {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  }
}

export default new ProntuarioChatController();

