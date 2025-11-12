import { Request, Response } from 'express';
import chatService from '../services/chat.service';

interface AuthUser {
  id: number;
  role: string;
  clinicaId: number | null;
}

class ChatController {
  async handleGetHandoffPacientes(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const pacientes = await chatService.getHandoffPacientes(user);
      return res.status(200).json(pacientes);
    } catch (error: any) {
      if (error.message === 'Acesso negado.') {
        return res.status(403).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async handleGetChatHistory(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const pacienteId = Number(req.params.pacienteId);

      const history = await chatService.getChatHistory(pacienteId, user);
      return res.status(200).json(history);
    } catch (error: any) {
      if (error.message.includes('Paciente não encontrado')) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async handleDoutorSendMessage(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const pacienteId = Number(req.params.pacienteId);
      const { content } = req.body;

      const newMessage = await chatService.doutorSendMensagem(pacienteId, content, user);
      return res.status(201).json(newMessage);
    } catch (error: any) {
      if (error.message.includes('Paciente não encontrado')) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('credenciais do WhatsApp')) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async handleCloseChat(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const pacienteId = Number(req.params.pacienteId);

      const paciente = await chatService.closeChat(pacienteId, user);
      return res.status(200).json(paciente);
    } catch (error: any) {
      if (error.message.includes('Paciente não encontrado')) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }
}

export default new ChatController();

