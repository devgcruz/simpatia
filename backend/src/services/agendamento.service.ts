import { prisma } from '../lib/prisma';

interface IFiltrosAgendamento {
    doutorId?: string;
    dataInicio?: string;
    dataFim?: string;
}

interface ICreateAgendamento {
    dataHora: Date | string;
    status: string;
    pacienteId: number;
    doutorId: number;
    servicoId: number;
}

interface IUpdateAgendamento {
    dataHora?: Date | string;
    status?: string;
    pacienteId?: number;
    doutorId?: number;
    servicoId?: number;
}

// NOVA INTERFACE PARA A IA
interface ICreateAgendamentoIA {
    dataHora: Date | string;
    pacienteId: number;
    doutorId: number;
    servicoId: number;
    clinicaId: number;
    status?: string;
    relatoPaciente?: string | undefined; // O que o paciente disse para realizar o agendamento
    entendimentoIA?: string | undefined; // Resumo/análise da IA sobre o que o paciente relatou
}

interface AuthUser {
    id: number;
    role: string;
    clinicaId: number;
}

const agendamentoInclude = {
    paciente: true,
    doutor: {
        select: {
            id: true,
            nome: true,
            email: true,
            clinicaId: true,
        },
    },
    servico: true,
};

class AgendamentoService {

    async getAll(user: AuthUser, filtros: IFiltrosAgendamento = {}) {
        const where: any = {};

        if (filtros.dataInicio && filtros.dataFim) {
            where.dataHora = {
                gte: new Date(filtros.dataInicio),
                lte: new Date(filtros.dataFim),
            };
        } else if (filtros.dataInicio) {
            where.dataHora = { gte: new Date(filtros.dataInicio) };
        } else if (filtros.dataFim) {
            where.dataHora = { lte: new Date(filtros.dataFim) };
        }

        if (user.role === 'DOUTOR') {
            where.doutorId = user.id;
        } else if (user.role === 'CLINICA_ADMIN') {
            where.doutor = { clinicaId: user.clinicaId };

            if (filtros.doutorId) {
                where.doutorId = Number(filtros.doutorId);
            }
        } else if (user.role === 'SUPER_ADMIN') {
            if (filtros.doutorId) {
                where.doutorId = Number(filtros.doutorId);
            }
        } else {
            return [];
        }

        const agendamentos = await prisma.agendamento.findMany({
            where,
            include: agendamentoInclude,
            orderBy: { dataHora: 'asc' },
        });

        return agendamentos.map(({ doutor, ...rest }) => ({
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        }));
    }

    async getById(id: number, user: AuthUser) {
        const agendamento = await prisma.agendamento.findUnique({
            where: { id },
            include: agendamentoInclude,
        });

        if (!agendamento) {
            throw new Error("Agendamento não encontrado.");
        }

        await this.ensureAccessToAgendamento(agendamento, user);

        const { doutor, ...rest } = agendamento;
        return {
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        };
    }

    async create(data: ICreateAgendamento, user: AuthUser) {
        const { dataHora, status, pacienteId, servicoId } = data;

        if (!dataHora || !status || !pacienteId || !servicoId) {
            throw new Error("dataHora, status, pacienteId e servicoId são obrigatórios.");
        }

        let targetDoutorId = data.doutorId;

        if (user.role === 'DOUTOR') {
            targetDoutorId = user.id;
        } else if (user.role === 'CLINICA_ADMIN') {
            if (!targetDoutorId) {
                throw new Error("doutorId é obrigatório.");
            }
        } else if (user.role !== 'SUPER_ADMIN') {
            throw new Error("Acesso negado.");
        }

        if (user.role !== 'SUPER_ADMIN') {
            await this.ensureEntitiesBelongToClinica({
                doutorId: targetDoutorId,
                pacienteId,
                servicoId,
                clinicaId: user.clinicaId,
            });
        } else {
            await this.ensureEntitiesExist({
                doutorId: targetDoutorId,
                pacienteId,
                servicoId,
            });
        }

        const dataHoraDate = typeof dataHora === 'string' ? new Date(dataHora) : dataHora;

        const novoAgendamento = await prisma.agendamento.create({
            data: {
                dataHora: dataHoraDate,
                status,
                pacienteId,
                doutorId: targetDoutorId,
                servicoId,
            },
            include: agendamentoInclude,
        });

        const { doutor, ...rest } = novoAgendamento;
        return {
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        };
    }

    // NOVO MÉTODO PARA A IA
    async createParaIA(data: ICreateAgendamentoIA) {
        const { dataHora, pacienteId, doutorId, servicoId, clinicaId, status, relatoPaciente, entendimentoIA } = data;

        console.log(`[AgendamentoService.createParaIA] Iniciando criação de agendamento:`, {
            dataHora,
            pacienteId,
            doutorId,
            servicoId,
            clinicaId,
            status,
        });

        if (!dataHora || !pacienteId || !doutorId || !servicoId || !clinicaId) {
            const erro = "dataHora, pacienteId, doutorId, servicoId e clinicaId são obrigatórios.";
            console.error(`[AgendamentoService.createParaIA] ❌ ${erro}`);
            throw new Error(erro);
        }

        // Validação de segurança: Garante que todas as entidades pertencem à clínica
        // que recebeu a mensagem do WhatsApp.
        console.log(`[AgendamentoService.createParaIA] Validando entidades...`);
        const [doutor, paciente, servico] = await Promise.all([
            prisma.doutor.findFirst({ where: { id: doutorId, clinicaId } }),
            prisma.paciente.findFirst({ where: { id: pacienteId, clinicaId } }),
            prisma.servico.findFirst({ where: { id: servicoId, clinicaId } }),
        ]);

        console.log(`[AgendamentoService.createParaIA] Resultado da validação:`, {
            doutor: doutor ? `ID ${doutor.id} - ${doutor.nome}` : 'NÃO ENCONTRADO',
            paciente: paciente ? `ID ${paciente.id} - ${paciente.nome}` : 'NÃO ENCONTRADO',
            servico: servico ? `ID ${servico.id} - ${servico.nome}` : 'NÃO ENCONTRADO',
        });

        if (!doutor || !paciente || !servico) {
            const erro = "Doutor, Paciente ou Serviço não encontrado ou não pertence à esta clínica.";
            console.error(`[AgendamentoService.createParaIA] ❌ ${erro}`);
            throw new Error(erro);
        }

        const dataHoraDate = typeof dataHora === 'string' ? new Date(dataHora) : dataHora;
        console.log(`[AgendamentoService.createParaIA] Data/hora processada:`, dataHoraDate);

        console.log(`[AgendamentoService.createParaIA] Criando agendamento no banco de dados...`);
        const novoAgendamento = await prisma.agendamento.create({
            data: {
                dataHora: dataHoraDate,
                status: status || 'pendente_ia', // Status padrão para agendamentos da IA
                pacienteId,
                doutorId,
                servicoId,
                relatoPaciente: relatoPaciente || undefined, // Salva o relato do paciente
                entendimentoIA: entendimentoIA || undefined, // Salva o entendimento da IA
            } as any, // Type assertion temporária até regenerar Prisma Client
            include: agendamentoInclude,
        });

        console.log(`[AgendamentoService.createParaIA] ✅ Agendamento criado com sucesso - ID: ${novoAgendamento.id}`);

        // Formata a resposta
        const { doutor: doutorInfo, ...rest } = novoAgendamento;
        return {
            ...rest,
            doutor: {
                id: doutorInfo.id,
                nome: doutorInfo.nome,
                email: doutorInfo.email,
            },
        };
    }

    /**
     * Busca agendamentos futuros de um paciente específico.
     */
    async getFuturosByPacienteId(pacienteId: number) {
        const agendamentos = await prisma.agendamento.findMany({
            where: {
                pacienteId: pacienteId,
                dataHora: {
                    gte: new Date(),
                },
                status: {
                    notIn: ['cancelado', 'finalizado'],
                },
            },
            include: agendamentoInclude,
            orderBy: {
                dataHora: 'asc',
            },
            take: 5,
        });

        return agendamentos.map(({ doutor, servico, ...rest }) => ({
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
            },
            servico: {
                id: servico.id,
                nome: servico.nome,
            },
        }));
    }

    /**
     * Busca agendamento do paciente por data, horário e nome do serviço (para cancelamento automático).
     */
    async buscarAgendamentoPorDetalhes(pacienteId: number, dataHoraISO: string, nomeServico: string, clinicaId: number) {
        const paciente = await prisma.paciente.findFirst({
            where: { id: pacienteId, clinicaId: clinicaId }
        });

        if (!paciente) {
            throw new Error("Paciente não encontrado ou não pertence a esta clínica.");
        }

        // Parse da data/hora ISO (ex: "2025-11-14T16:00:00")
        const dataHora = new Date(dataHoraISO);
        if (isNaN(dataHora.getTime())) {
            throw new Error("Data/hora inválida.");
        }

        // Criar range de 1 hora antes e depois para buscar agendamentos próximos ao horário informado
        const inicioHora = new Date(dataHora);
        inicioHora.setHours(dataHora.getHours() - 1);
        
        const fimHora = new Date(dataHora);
        fimHora.setHours(dataHora.getHours() + 1);

        const agendamentos = await prisma.agendamento.findMany({
            where: {
                pacienteId: pacienteId,
                dataHora: {
                    gte: inicioHora,
                    lte: fimHora,
                },
                status: {
                    notIn: ['cancelado', 'finalizado'],
                },
                servico: {
                    nome: {
                        contains: nomeServico,
                        mode: 'insensitive',
                    },
                },
            },
            include: agendamentoInclude,
        });

        if (agendamentos.length === 0) {
            throw new Error(`Não encontrei agendamento de ${nomeServico} para o horário informado.`);
        }

        // Se houver múltiplos, pegar o mais próximo do horário informado
        const agendamento = agendamentos.sort((a, b) => {
            const diffA = Math.abs(a.dataHora.getTime() - dataHora.getTime());
            const diffB = Math.abs(b.dataHora.getTime() - dataHora.getTime());
            return diffA - diffB;
        })[0];

        return agendamento;
    }

    /**
     * Cancela um agendamento a pedido do paciente (via IA).
     * Verifica a posse do agendamento antes de cancelar.
     */
    async cancelarParaPaciente(agendamentoId: number, pacienteId: number, clinicaId: number) {
        const paciente = await prisma.paciente.findFirst({
            where: { id: pacienteId, clinicaId: clinicaId }
        });

        if (!paciente) {
            throw new Error("Paciente não encontrado ou não pertence a esta clínica.");
        }

        const agendamento = await prisma.agendamento.findFirst({
            where: {
                id: agendamentoId,
                pacienteId: pacienteId,
            }
        });

        if (!agendamento) {
            throw new Error("Agendamento não encontrado ou não pertence a este paciente.");
        }

        if (agendamento.status === 'cancelado' || agendamento.status === 'finalizado') {
            throw new Error(`Este agendamento já está ${agendamento.status} e não pode ser cancelado.`);
        }

        const agendamentoCancelado = await prisma.agendamento.update({
            where: { id: agendamentoId },
            data: { status: 'cancelado' },
            include: agendamentoInclude,
        });

        const { doutor, ...rest } = agendamentoCancelado;
        return {
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        };
    }

    async update(id: number, data: IUpdateAgendamento, user: AuthUser) {
        const agendamentoExistente = await prisma.agendamento.findUnique({
            where: { id },
            include: agendamentoInclude,
        });

        if (!agendamentoExistente) {
            throw new Error("Agendamento não encontrado.");
        }

        await this.ensureAccessToAgendamento(agendamentoExistente, user);

        if (data.doutorId && data.doutorId !== agendamentoExistente.doutorId) {
            if (user.role === 'DOUTOR') {
                throw new Error("Acesso negado.");
            }
        }

        const targetDoutorId = data.doutorId ?? agendamentoExistente.doutorId;
        const targetPacienteId = data.pacienteId ?? agendamentoExistente.pacienteId;
        const targetServicoId = data.servicoId ?? agendamentoExistente.servicoId;

        if (user.role !== 'SUPER_ADMIN') {
            await this.ensureEntitiesBelongToClinica({
                doutorId: targetDoutorId,
                pacienteId: targetPacienteId,
                servicoId: targetServicoId,
                clinicaId: user.clinicaId,
            });
        } else {
            await this.ensureEntitiesExist({
                doutorId: targetDoutorId,
                pacienteId: targetPacienteId,
                servicoId: targetServicoId,
            });
        }

        const updateData: any = { ...data };
        if (data.dataHora) {
            updateData.dataHora = typeof data.dataHora === 'string' ? new Date(data.dataHora) : data.dataHora;
        }

        const agendamentoAtualizado = await prisma.agendamento.update({
            where: { id },
            data: updateData,
            include: agendamentoInclude,
        });

        const { doutor, ...rest } = agendamentoAtualizado;
        return {
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        };
    }

    async finalize(id: number, descricao: string, user: AuthUser) {
        if (!descricao || !descricao.trim()) {
            throw new Error("Uma descrição do atendimento é obrigatória para finalizar a consulta.");
        }

        const agendamentoExistente = await prisma.agendamento.findUnique({
            where: { id },
            include: agendamentoInclude,
        });

        if (!agendamentoExistente) {
            throw new Error("Agendamento não encontrado.");
        }

        await this.ensureAccessToAgendamento(agendamentoExistente, user);

        const agendamentoFinalizado = await prisma.$transaction(async (tx) => {
            const atualizado = await tx.agendamento.update({
                where: { id },
                data: { status: 'finalizado' },
                include: agendamentoInclude,
            });

            const historicoDelegate = tx as any;
            await historicoDelegate.historicoPaciente.create({
                data: {
                    pacienteId: atualizado.pacienteId,
                    agendamentoId: atualizado.id,
                    descricao: descricao.trim(),
                    realizadoEm: new Date(atualizado.dataHora),
                },
            });

            return atualizado;
        });

        const { doutor, ...rest } = agendamentoFinalizado;
        return {
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        };
    }

    async delete(id: number, user: AuthUser) {
        const agendamentoExistente = await prisma.agendamento.findUnique({
            where: { id },
            include: agendamentoInclude,
        });

        if (!agendamentoExistente) {
            throw new Error("Agendamento não encontrado.");
        }

        await this.ensureAccessToAgendamento(agendamentoExistente, user);

        await prisma.agendamento.delete({
            where: { id },
        });

        return { message: "Agendamento deletado com sucesso." };
    }

    private async ensureAccessToAgendamento(agendamento: any, user: AuthUser) {
        if (user.role === 'DOUTOR') {
            if (agendamento.doutorId !== user.id) {
                throw new Error("Acesso negado.");
            }
        } else if (user.role === 'CLINICA_ADMIN') {
            if (agendamento.doutor.clinicaId !== user.clinicaId) {
                throw new Error("Acesso negado.");
            }
        }
    }

    private async ensureEntitiesBelongToClinica(params: { doutorId: number; pacienteId: number; servicoId: number; clinicaId: number; }) {
        const { doutorId, pacienteId, servicoId, clinicaId } = params;

        const [doutor, paciente, servico] = await Promise.all([
            prisma.doutor.findFirst({ where: { id: doutorId, clinicaId } }),
            prisma.paciente.findFirst({ where: { id: pacienteId, clinicaId } }),
            prisma.servico.findFirst({ where: { id: servicoId, clinicaId } }),
        ]);

        if (!doutor || !paciente || !servico) {
            throw new Error("Doutor, Paciente ou Serviço não encontrado ou não pertence à esta clínica.");
        }
    }

    private async ensureEntitiesExist(params: { doutorId: number; pacienteId: number; servicoId: number; }) {
        const { doutorId, pacienteId, servicoId } = params;

        const [doutor, paciente, servico] = await Promise.all([
            prisma.doutor.findUnique({ where: { id: doutorId } }),
            prisma.paciente.findUnique({ where: { id: pacienteId } }),
            prisma.servico.findUnique({ where: { id: servicoId } }),
        ]);

        if (!doutor) {
            throw new Error("Doutor não encontrado.");
        }
        if (!paciente) {
            throw new Error("Paciente não encontrado.");
        }
        if (!servico) {
            throw new Error("Serviço não encontrado.");
        }
    }
}

export default new AgendamentoService();

