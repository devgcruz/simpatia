import { Request, Response } from 'express';
import chatService from '../services/chat.service';
import { prisma } from '../lib/prisma';

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

  /**
   * GET /api/chat/public-key/:userId
   * Busca a chave pública E2E de um usuário (Doutor ou Paciente)
   * Qualquer usuário autenticado pode buscar para iniciar conversa E2E
   */
  async handleGetPublicKey(req: Request, res: Response) {
    try {
      const userId = Number(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({ message: 'ID de usuário inválido.' });
      }

      // Tentar buscar como Doutor primeiro
      const doutor = await prisma.doutor.findUnique({
        where: { id: userId },
        select: { id: true, publicKey: true },
      });

      if (doutor && doutor.publicKey) {
        return res.status(200).json({ publicKey: doutor.publicKey });
      }

      // Se não encontrou como Doutor, tentar como Paciente
      const paciente = await prisma.paciente.findUnique({
        where: { id: userId },
        select: { id: true, publicKey: true },
      });

      if (paciente && paciente.publicKey) {
        return res.status(200).json({ publicKey: paciente.publicKey });
      }

      // Se não encontrou em nenhum dos dois
      return res.status(404).json({ message: 'Chave pública não encontrada para este usuário.' });
    } catch (error: any) {
      console.error('[Chat Controller] Erro ao buscar chave pública:', error);
      return res.status(500).json({ message: error.message || 'Erro ao buscar chave pública.' });
    }
  }
}

export default new ChatController();

