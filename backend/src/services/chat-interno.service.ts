import { prisma } from '../lib/prisma';
import { encryptMessage, decryptMessage } from '../utils/crypto.util';
import { ChatInternoTipo, MensagemInternaTipo, MensagemInternaStatus } from '@prisma/client';

interface CreateConversaIndividualDTO {
  usuarioId1: number;
  usuarioId2: number;
  clinicaId: number;
}

interface CreateConversaGrupoDTO {
  nome: string;
  descricao?: string;
  criadoPor: number;
  clinicaId: number;
  participantesIds: number[];
}

interface SendMensagemDTO {
  conversaId: number;
  remetenteId: number;
  tipo: MensagemInternaTipo;
  conteudo: string;
  criptografar?: boolean; // Se true, criptografa o conteúdo
}

interface UpdateMensagemDTO {
  mensagemId: number;
  remetenteId: number;
  novoConteudo: string;
}

class ChatInternoService {
  /**
   * Cria uma conversa individual (1:1)
   */
  async createConversaIndividual(data: CreateConversaIndividualDTO) {
    const { usuarioId1, usuarioId2, clinicaId } = data;

    // Verificar se já existe uma conversa individual entre estes dois usuários
    const conversaExistente = await prisma.conversaInterna.findFirst({
      where: {
        tipo: ChatInternoTipo.INDIVIDUAL,
        clinicaId,
        participantes: {
          every: {
            usuarioId: {
              in: [usuarioId1, usuarioId2],
            },
          },
        },
      },
      include: {
        participantes: true,
      },
    });

    if (conversaExistente) {
      return conversaExistente;
    }

    // Criar nova conversa individual
    const conversa = await prisma.conversaInterna.create({
      data: {
        tipo: ChatInternoTipo.INDIVIDUAL,
        clinicaId,
        criadoPor: usuarioId1,
        participantes: {
          create: [
            { usuarioId: usuarioId1 },
            { usuarioId: usuarioId2 },
          ],
        },
      },
      include: {
        participantes: {
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                email: true,
                role: true,
                fotoPerfil: true,
              },
            },
          },
        },
      },
    });

    return conversa;
  }

  /**
   * Cria uma conversa em grupo
   */
  async createConversaGrupo(data: CreateConversaGrupoDTO) {
    const { nome, descricao, criadoPor, clinicaId, participantesIds } = data;

    // Verificar permissão (apenas ADMIN pode criar grupos)
    const criador = await prisma.doutor.findUnique({
      where: { id: criadoPor },
    });

    if (!criador || (criador.role !== 'CLINICA_ADMIN' && criador.role !== 'SUPER_ADMIN')) {
      throw new Error('Apenas administradores podem criar grupos');
    }

    // Garantir que o criador está na lista de participantes
    const participantes = [...new Set([criadoPor, ...participantesIds])];

    const conversa = await prisma.conversaInterna.create({
      data: {
        tipo: ChatInternoTipo.GRUPO,
        nome,
        descricao: descricao || null,
        clinicaId,
        criadoPor,
        participantes: {
          create: participantes.map((usuarioId) => ({
            usuarioId,
            adicionadoPor: criadoPor,
          })),
        },
      },
      include: {
        participantes: {
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                email: true,
                role: true,
                fotoPerfil: true,
              },
            },
          },
        },
      },
    });

    return conversa;
  }

  /**
   * Lista todas as conversas de um usuário
   */
  async listConversas(usuarioId: number, clinicaId: number) {
    const conversas = await prisma.conversaInterna.findMany({
      where: {
        clinicaId,
        participantes: {
          some: {
            usuarioId,
          },
        },
      },
      include: {
        participantes: {
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                email: true,
                role: true,
                fotoPerfil: true,
              },
            },
          },
        },
        mensagens: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
          remetente: {
            select: {
              id: true,
              nome: true,
              fotoPerfil: true,
            },
          },
          },
        },
        _count: {
          select: {
            mensagens: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Adicionar contagem de mensagens não lidas
    const conversasComEstatisticas = await Promise.all(
      conversas.map(async (conversa) => {
        const participante = conversa.participantes.find((p) => p.usuarioId === usuarioId);
        const ultimaLeitura = participante?.ultimaLeitura;

        const mensagensNaoLidas = ultimaLeitura
          ? await prisma.mensagemInterna.count({
              where: {
                conversaId: conversa.id,
                remetenteId: { not: usuarioId },
                createdAt: { gt: ultimaLeitura },
              },
            })
          : await prisma.mensagemInterna.count({
              where: {
                conversaId: conversa.id,
                remetenteId: { not: usuarioId },
              },
            });

        return {
          ...conversa,
          mensagensNaoLidas,
        };
      })
    );

    return conversasComEstatisticas;
  }

  /**
   * Obtém mensagens de uma conversa com paginação
   */
  async getMensagens(
    conversaId: number,
    usuarioId: number,
    page: number = 1,
    limit: number = 50
  ) {
    // Verificar se o usuário é participante da conversa
    const participante = await prisma.participanteConversa.findUnique({
      where: {
        conversaId_usuarioId: {
          conversaId,
          usuarioId,
        },
      },
    });

    if (!participante) {
      throw new Error('Usuário não é participante desta conversa');
    }

    const skip = (page - 1) * limit;

    const [mensagens, total] = await Promise.all([
      prisma.mensagemInterna.findMany({
        where: { conversaId },
        include: {
          remetente: {
            select: {
              id: true,
              nome: true,
              email: true,
              role: true,
              fotoPerfil: true,
            },
          },
          leituras: {
            where: {
              usuarioId,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip,
      }),
      prisma.mensagemInterna.count({
        where: { conversaId },
      }),
    ]);

    // Descriptografar mensagens criptografadas
    const mensagensDescriptografadas = mensagens.map((msg) => {
      let conteudo = msg.conteudo;
      if (msg.conteudoCriptografado) {
        try {
          conteudo = decryptMessage(msg.conteudoCriptografado);
        } catch (error) {
          console.error('Erro ao descriptografar mensagem:', error);
          conteudo = '[Erro ao descriptografar mensagem]';
        }
      }

      return {
        ...msg,
        conteudo,
        lida: msg.leituras.length > 0,
      };
    });

    return {
      mensagens: mensagensDescriptografadas.reverse(), // Reverter para ordem cronológica
      paginacao: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Envia uma mensagem
   */
  async sendMensagem(data: SendMensagemDTO) {
    const { conversaId, remetenteId, tipo, conteudo, criptografar } = data;

    // Verificar se o usuário é participante da conversa
    const participante = await prisma.participanteConversa.findUnique({
      where: {
        conversaId_usuarioId: {
          conversaId,
          usuarioId: remetenteId,
        },
      },
    });

    if (!participante) {
      throw new Error('Usuário não é participante desta conversa');
    }

    // Criptografar se solicitado
    let conteudoCriptografado: string | null = null;
    let conteudoFinal = conteudo;

    if (criptografar) {
      conteudoCriptografado = encryptMessage(conteudo);
      conteudoFinal = '[Mensagem criptografada]';
    }

    const mensagem = await prisma.mensagemInterna.create({
      data: {
        conversaId,
        remetenteId,
        tipo,
        conteudo: conteudoFinal,
        conteudoCriptografado,
        status: MensagemInternaStatus.ENVIADA,
      },
      include: {
        remetente: {
          select: {
            id: true,
            nome: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Atualizar updatedAt da conversa
    await prisma.conversaInterna.update({
      where: { id: conversaId },
      data: { updatedAt: new Date() },
    });

    return mensagem;
  }

  /**
   * Marca mensagens como lidas
   */
  async marcarMensagensComoLidas(conversaId: number, usuarioId: number) {
    // Obter mensagens não lidas
    const participante = await prisma.participanteConversa.findUnique({
      where: {
        conversaId_usuarioId: {
          conversaId,
          usuarioId,
        },
      },
    });

    if (!participante) {
      throw new Error('Usuário não é participante desta conversa');
    }

    const ultimaLeitura = participante.ultimaLeitura || new Date(0);

    const mensagensNaoLidas = await prisma.mensagemInterna.findMany({
      where: {
        conversaId,
        remetenteId: { not: usuarioId },
        createdAt: { gt: ultimaLeitura },
      },
      select: {
        id: true,
      },
    });

    // Criar registros de leitura
    if (mensagensNaoLidas.length > 0) {
      await prisma.leituraMensagem.createMany({
        data: mensagensNaoLidas.map((msg) => ({
          mensagemId: msg.id,
          usuarioId,
        })),
        skipDuplicates: true,
      });

      // Atualizar status das mensagens
      await prisma.mensagemInterna.updateMany({
        where: {
          id: { in: mensagensNaoLidas.map((m) => m.id) },
        },
        data: {
          status: MensagemInternaStatus.LIDA,
        },
      });
    }

    // Atualizar última leitura do participante
    await prisma.participanteConversa.update({
      where: {
        conversaId_usuarioId: {
          conversaId,
          usuarioId,
        },
      },
      data: {
        ultimaLeitura: new Date(),
      },
    });

    return { marcadas: mensagensNaoLidas.length };
  }

  /**
   * Adiciona participante a um grupo
   */
  async adicionarParticipante(
    conversaId: number,
    novoParticipanteId: number,
    adicionadoPor: number
  ) {
    // Verificar se a conversa é um grupo
    const conversa = await prisma.conversaInterna.findUnique({
      where: { id: conversaId },
    });

    if (!conversa || conversa.tipo !== ChatInternoTipo.GRUPO) {
      throw new Error('Apenas grupos podem ter participantes adicionados');
    }

    // Verificar permissão
    const adicionador = await prisma.doutor.findUnique({
      where: { id: adicionadoPor },
    });

    if (
      !adicionador ||
      (adicionador.role !== 'CLINICA_ADMIN' &&
        adicionador.role !== 'SUPER_ADMIN' &&
        conversa.criadoPor !== adicionadoPor)
    ) {
      throw new Error('Sem permissão para adicionar participantes');
    }

    const participante = await prisma.participanteConversa.create({
      data: {
        conversaId,
        usuarioId: novoParticipanteId,
        adicionadoPor,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            role: true,
            fotoPerfil: true,
          },
        },
      },
    });

    return participante;
  }

  /**
   * Remove participante de um grupo
   */
  async removerParticipante(
    conversaId: number,
    participanteId: number,
    removidoPor: number
  ) {
    // Verificar permissão
    const remover = await prisma.doutor.findUnique({
      where: { id: removidoPor },
    });

    const conversa = await prisma.conversaInterna.findUnique({
      where: { id: conversaId },
    });

    if (
      !remover ||
      !conversa ||
      (remover.role !== 'CLINICA_ADMIN' &&
        remover.role !== 'SUPER_ADMIN' &&
        conversa.criadoPor !== removidoPor &&
        participanteId !== removidoPor)
    ) {
      throw new Error('Sem permissão para remover participantes');
    }

    await prisma.participanteConversa.delete({
      where: {
        conversaId_usuarioId: {
          conversaId,
          usuarioId: participanteId,
        },
      },
    });

    return { sucesso: true };
  }

  /**
   * Atualiza status online/offline do usuário
   */
  async updateStatusOnline(usuarioId: number, online: boolean, digitandoEmConversaId?: number) {
    await prisma.statusUsuario.upsert({
      where: { usuarioId },
      create: {
        usuarioId,
        online,
        ultimaVezOnline: online ? new Date() : null,
        digitandoEmConversaId: online ? digitandoEmConversaId || null : null,
      },
      update: {
        online,
        ultimaVezOnline: online ? new Date() : null,
        digitandoEmConversaId: online ? digitandoEmConversaId || null : null,
      },
    });
  }

  /**
   * Busca usuários online
   * Considera offline usuários que não atualizaram o status há mais de 2 minutos
   */
  async getUsuariosOnline(clinicaId: number) {
    const doisMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);

    // Primeiro, marcar como offline usuários que não atualizaram há mais de 2 minutos
    await prisma.statusUsuario.updateMany({
      where: {
        online: true,
        ultimaVezOnline: {
          lt: doisMinutosAtras,
        },
        usuario: {
          clinicaId,
          ativo: true,
        },
      },
      data: {
        online: false,
      },
    });

    // Agora buscar apenas usuários realmente online
    const usuarios = await prisma.statusUsuario.findMany({
      where: {
        online: true,
        usuario: {
          clinicaId,
          ativo: true,
        },
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            role: true,
            fotoPerfil: true,
          },
        },
      },
    });

    return usuarios;
  }

  /**
   * Lista todos os usuários disponíveis para chat na clínica
   */
  async getUsuariosDisponiveis(clinicaId: number, usuarioIdExcluir?: number) {
    const whereClause: any = {
      clinicaId,
      ativo: true,
    };

    // Sempre excluir o próprio usuário se fornecido
    if (usuarioIdExcluir) {
      whereClause.id = { not: usuarioIdExcluir };
    }

    const usuarios = await prisma.doutor.findMany({
      where: whereClause,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        fotoPerfil: true,
      },
      orderBy: {
        nome: 'asc',
      },
    });

    return usuarios;
  }

  /**
   * Busca conversas e usuários
   */
  async buscarConversas(usuarioId: number, clinicaId: number, termo: string) {
    const conversas = await prisma.conversaInterna.findMany({
      where: {
        clinicaId,
        participantes: {
          some: {
            usuarioId,
          },
        },
        OR: [
          { nome: { contains: termo, mode: 'insensitive' } },
          { descricao: { contains: termo, mode: 'insensitive' } },
        ],
      },
      include: {
        participantes: {
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                email: true,
                role: true,
                fotoPerfil: true,
              },
            },
          },
        },
      },
    });

    return conversas;
  }
}

export default new ChatInternoService();

