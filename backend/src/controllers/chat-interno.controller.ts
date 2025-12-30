import { Request, Response } from 'express';
import chatInternoService from '../services/chat-interno.service';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Schemas de validação
const createConversaIndividualSchema = z.object({
  usuarioId2: z.number().int().positive(),
});

const createConversaGrupoSchema = z.object({
  nome: z.string().min(1).max(100),
  descricao: z.string().max(500).optional(),
  participantesIds: z.array(z.number().int().positive()).min(1),
});

const sendMensagemSchema = z.object({
  conversaId: z.number().int().positive(),
  tipo: z.enum(['TEXTO', 'IMAGEM', 'PDF', 'EMOJI']),
  conteudo: z.string().min(1).max(10000),
});

class ChatInternoController {
  /**
   * Cria uma conversa individual
   */
  async createConversaIndividual(req: Request, res: Response) {
    try {
      const { usuarioId2 } = createConversaIndividualSchema.parse(req.body);
      const usuarioId1 = req.user!.id;
      const clinicaId = req.user!.clinicaId!;

      if (!clinicaId) {
        return res.status(400).json({ message: 'Usuário não está associado a uma clínica' });
      }

      const conversa = await chatInternoService.createConversaIndividual({
        usuarioId1,
        usuarioId2,
        clinicaId,
      });

      return res.status(201).json(conversa);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Erro ao criar conversa individual:', error);
      return res.status(500).json({ message: 'Erro ao criar conversa' });
    }
  }

  /**
   * Cria uma conversa em grupo
   */
  async createConversaGrupo(req: Request, res: Response) {
    try {
      const data = createConversaGrupoSchema.parse(req.body);
      const criadoPor = req.user!.id;
      const clinicaId = req.user!.clinicaId!;

      if (!clinicaId) {
        return res.status(400).json({ message: 'Usuário não está associado a uma clínica' });
      }

      const conversa = await chatInternoService.createConversaGrupo({
        ...data,
        criadoPor,
        clinicaId,
      });

      return res.status(201).json(conversa);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      if (error.message.includes('permissão')) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Erro ao criar conversa em grupo:', error);
      return res.status(500).json({ message: 'Erro ao criar grupo' });
    }
  }

  /**
   * Lista todas as conversas do usuário
   */
  async listConversas(req: Request, res: Response) {
    try {
      const usuarioId = req.user!.id;
      const clinicaId = req.user!.clinicaId!;

      if (!clinicaId) {
        return res.status(400).json({ message: 'Usuário não está associado a uma clínica' });
      }

      const conversas = await chatInternoService.listConversas(usuarioId, clinicaId);
      return res.json(conversas);
    } catch (error: any) {
      console.error('Erro ao listar conversas:', error);
      return res.status(500).json({ message: 'Erro ao listar conversas' });
    }
  }

  /**
   * Obtém mensagens de uma conversa
   */
  async getMensagens(req: Request, res: Response) {
    try {
      const conversaId = parseInt(req.params.conversaId);
      const usuarioId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      if (isNaN(conversaId)) {
        return res.status(400).json({ message: 'ID da conversa inválido' });
      }

      const resultado = await chatInternoService.getMensagens(conversaId, usuarioId, page, limit);
      return res.json(resultado);
    } catch (error: any) {
      if (error.message.includes('participante')) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Erro ao obter mensagens:', error);
      return res.status(500).json({ message: 'Erro ao obter mensagens' });
    }
  }

  /**
   * Envia uma mensagem
   */
  async sendMensagem(req: Request, res: Response) {
    try {
      const data = sendMensagemSchema.parse(req.body);
      const remetenteId = req.user!.id;

      const mensagem = await chatInternoService.sendMensagem({
        ...data,
        remetenteId,
      });

      return res.status(201).json(mensagem);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      if (error.message.includes('participante')) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Erro ao enviar mensagem:', error);
      return res.status(500).json({ message: 'Erro ao enviar mensagem' });
    }
  }

  /**
   * Marca mensagens como lidas
   */
  async marcarMensagensComoLidas(req: Request, res: Response) {
    try {
      const conversaId = parseInt(req.params.conversaId);
      const usuarioId = req.user!.id;

      if (isNaN(conversaId)) {
        return res.status(400).json({ message: 'ID da conversa inválido' });
      }

      const resultado = await chatInternoService.marcarMensagensComoLidas(conversaId, usuarioId);
      return res.json(resultado);
    } catch (error: any) {
      if (error.message.includes('participante')) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Erro ao marcar mensagens como lidas:', error);
      return res.status(500).json({ message: 'Erro ao marcar mensagens' });
    }
  }

  /**
   * Adiciona participante a um grupo
   */
  async adicionarParticipante(req: Request, res: Response) {
    try {
      const conversaId = parseInt(req.params.conversaId);
      const { usuarioId } = z.object({ usuarioId: z.number().int().positive() }).parse(req.body);
      const adicionadoPor = req.user!.id;

      if (isNaN(conversaId)) {
        return res.status(400).json({ message: 'ID da conversa inválido' });
      }

      const participante = await chatInternoService.adicionarParticipante(
        conversaId,
        usuarioId,
        adicionadoPor
      );
      return res.json(participante);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      if (error.message.includes('permissão') || error.message.includes('grupo')) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Erro ao adicionar participante:', error);
      return res.status(500).json({ message: 'Erro ao adicionar participante' });
    }
  }

  /**
   * Remove participante de um grupo
   */
  async removerParticipante(req: Request, res: Response) {
    try {
      const conversaId = parseInt(req.params.conversaId);
      const { usuarioId } = z.object({ usuarioId: z.number().int().positive() }).parse(req.body);
      const removidoPor = req.user!.id;

      if (isNaN(conversaId)) {
        return res.status(400).json({ message: 'ID da conversa inválido' });
      }

      const resultado = await chatInternoService.removerParticipante(
        conversaId,
        usuarioId,
        removidoPor
      );
      return res.json(resultado);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      if (error.message.includes('permissão')) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Erro ao remover participante:', error);
      return res.status(500).json({ message: 'Erro ao remover participante' });
    }
  }

  /**
   * Obtém usuários online
   */
  async getUsuariosOnline(req: Request, res: Response) {
    try {
      const clinicaId = req.user!.clinicaId!;

      if (!clinicaId) {
        return res.status(400).json({ message: 'Usuário não está associado a uma clínica' });
      }

      const usuarios = await chatInternoService.getUsuariosOnline(clinicaId);
      return res.json(usuarios);
    } catch (error: any) {
      console.error('Erro ao obter usuários online:', error);
      return res.status(500).json({ message: 'Erro ao obter usuários online' });
    }
  }

  /**
   * Lista todos os usuários disponíveis para chat
   */
  async getUsuariosDisponiveis(req: Request, res: Response) {
    try {
      const clinicaId = req.user!.clinicaId!;
      const usuarioId = req.user!.id;

      if (!clinicaId) {
        return res.status(400).json({ message: 'Usuário não está associado a uma clínica' });
      }

      const usuarios = await chatInternoService.getUsuariosDisponiveis(clinicaId, usuarioId);
      return res.json(usuarios);
    } catch (error: any) {
      console.error('Erro ao obter usuários disponíveis:', error);
      return res.status(500).json({ message: 'Erro ao obter usuários disponíveis' });
    }
  }

  /**
   * Busca conversas
   */
  async buscarConversas(req: Request, res: Response) {
    try {
      const termo = req.query.termo as string;
      const usuarioId = req.user!.id;
      const clinicaId = req.user!.clinicaId!;

      if (!termo || termo.trim().length === 0) {
        return res.status(400).json({ message: 'Termo de busca é obrigatório' });
      }

      if (!clinicaId) {
        return res.status(400).json({ message: 'Usuário não está associado a uma clínica' });
      }

      const conversas = await chatInternoService.buscarConversas(usuarioId, clinicaId, termo);
      return res.json(conversas);
    } catch (error: any) {
      console.error('Erro ao buscar conversas:', error);
      return res.status(500).json({ message: 'Erro ao buscar conversas' });
    }
  }
}

export default new ChatInternoController();

