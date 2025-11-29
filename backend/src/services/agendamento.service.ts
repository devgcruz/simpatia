import { prisma } from '../lib/prisma';
import * as pausaExcecaoService from './pausa-excecao.service';

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
    isEncaixe?: boolean; // Permite agendar em horário parcialmente ocupado
}

interface IUpdateAgendamento {
    dataHora?: Date | string;
    status?: string;
    pacienteId?: number;
    doutorId?: number;
    servicoId?: number;
    isEncaixe?: boolean;
    confirmadoPorMedico?: boolean; // Permite médico confirmar encaixe
    motivoCancelamento?: string; // Motivo do cancelamento (obrigatório ao cancelar)
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
    isEncaixe?: boolean; // Permite agendar em horário parcialmente ocupado
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
            especialidade: true,
            crm: true,
            crmUf: true,
            rqe: true,
            clinicaId: true,
            clinica: {
                select: {
                    id: true,
                    nome: true,
                    cnpj: true,
                    endereco: true,
                    telefone: true,
                    email: true,
                    site: true,
                },
            },
        },
    },
    servico: true,
};

class AgendamentoService {

    /**
     * Verifica se há conflito de horário com agendamentos existentes
     * Retorna true se há conflito, false caso contrário
     */
    private async verificarConflitoHorario(
        dataHora: Date,
        duracaoMin: number,
        doutorId: number,
        agendamentoIdExcluir?: number // Para permitir atualização de agendamento existente
    ): Promise<{ temConflito: boolean; agendamentosConflitantes: any[] }> {
        const agendamentoInicioMinutos = dataHora.getHours() * 60 + dataHora.getMinutes();
        const agendamentoFimMinutos = agendamentoInicioMinutos + duracaoMin;

        // Buscar dia do agendamento
        const dayStart = new Date(dataHora);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dataHora);
        dayEnd.setHours(23, 59, 59, 999);

        // Buscar agendamentos do doutor no mesmo dia
        const whereClause: any = {
            doutorId: doutorId,
            dataHora: {
                gte: dayStart,
                lte: dayEnd,
            },
            status: {
                not: 'cancelado',
            },
            ativo: true,
        };

        // Excluir o próprio agendamento se estiver atualizando
        if (agendamentoIdExcluir) {
            whereClause.id = { not: agendamentoIdExcluir };
        }

        const agendamentos = await prisma.agendamento.findMany({
            where: whereClause,
            include: {
                servico: true,
            },
        });

        const conflitantes: any[] = [];

        for (const agendamento of agendamentos) {
            const agendamentoDataHora = new Date(agendamento.dataHora);
            const agendamentoHora = agendamentoDataHora.getHours();
            const agendamentoMin = agendamentoDataHora.getMinutes();
            const agendamentoStartMin = agendamentoHora * 60 + agendamentoMin;
            const agendamentoDuracao = agendamento.servico.duracaoMin;
            const agendamentoEndMin = agendamentoStartMin + agendamentoDuracao;

            // Verificar sobreposição
            if (
                agendamentoInicioMinutos < agendamentoEndMin &&
                agendamentoFimMinutos > agendamentoStartMin
            ) {
                conflitantes.push(agendamento);
            }
        }

        return {
            temConflito: conflitantes.length > 0,
            agendamentosConflitantes: conflitantes,
        };
    }

    /**
     * Valida se o horário do agendamento não conflita com o horário de almoço do doutor
     */
    private async validarHorarioAlmoco(
        dataHora: Date,
        duracaoMin: number,
        doutorId: number,
        pausaInicioDefault?: string | null,
        pausaFimDefault?: string | null,
        diasBloqueados?: number[] | null
    ): Promise<void> {
        // Verificar se o dia da semana está bloqueado
        const diaSemana = dataHora.getDay(); // 0 = Domingo, 6 = Sábado
        if (diasBloqueados && diasBloqueados.includes(diaSemana)) {
            throw new Error("Não é possível agendar em um dia bloqueado para este doutor.");
        }

        // Se não houver horário de almoço configurado, não há restrição
        if (!pausaInicioDefault || !pausaFimDefault) {
            return;
        }

        // Buscar exceção de pausa para esta data específica
        const dataStr = dataHora.toISOString().split('T')[0] as string; // YYYY-MM-DD
        let excecaoPausa = null;
        if (typeof doutorId === 'number') {
            excecaoPausa = await pausaExcecaoService.findByDate(dataStr, undefined, doutorId);
        }
        
        // Usar horário de exceção se existir, senão usar o padrão
        const pausaInicio = excecaoPausa ? excecaoPausa.pausaInicio : pausaInicioDefault;
        const pausaFim = excecaoPausa ? excecaoPausa.pausaFim : pausaFimDefault;

        // Converter horários para minutos do dia
        const [pausaInicioH, pausaInicioM] = pausaInicio.split(':').map(Number);
        const [pausaFimH, pausaFimM] = pausaFim.split(':').map(Number);
        
        const pausaInicioMinutos = pausaInicioH * 60 + pausaInicioM;
        const pausaFimMinutos = pausaFimH * 60 + pausaFimM;

        // Calcular horário de início e fim do agendamento em minutos do dia
        const agendamentoInicioMinutos = dataHora.getHours() * 60 + dataHora.getMinutes();
        const agendamentoFimMinutos = agendamentoInicioMinutos + duracaoMin;

        // Verificar se há sobreposição entre agendamento e horário de almoço
        // O agendamento não pode começar durante a pausa
        // O agendamento não pode terminar durante a pausa
        // O agendamento não pode envolver completamente a pausa
        const conflita =
            (agendamentoInicioMinutos >= pausaInicioMinutos && agendamentoInicioMinutos < pausaFimMinutos) ||
            (agendamentoFimMinutos > pausaInicioMinutos && agendamentoFimMinutos <= pausaFimMinutos) ||
            (agendamentoInicioMinutos <= pausaInicioMinutos && agendamentoFimMinutos >= pausaFimMinutos);

        if (conflita) {
            throw new Error(`Não é possível agendar no horário de almoço do doutor (${pausaInicio} - ${pausaFim}).`);
        }
    }

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
        } else if (user.role === 'SECRETARIA') {
            // Buscar IDs dos doutores vinculados à secretária
            const vinculos = await prisma.secretariaDoutor.findMany({
                where: { secretariaId: user.id },
                select: { doutorId: true },
            });
            const doutorIds = vinculos.map((v) => v.doutorId);
            
            if (doutorIds.length === 0) {
                return []; // Secretária sem vínculos não vê nada
            }
            
            // Se filtro de doutor específico, verificar se está nos vínculos
            if (filtros.doutorId) {
                const doutorIdFiltro = Number(filtros.doutorId);
                if (doutorIds.includes(doutorIdFiltro)) {
                    where.doutorId = doutorIdFiltro;
                } else {
                    return []; // Doutor não vinculado
                }
            } else {
                where.doutorId = { in: doutorIds };
            }
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

        // Filtrar apenas agendamentos ativos
        where.ativo = true;

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
        } else if (user.role === 'SECRETARIA') {
            if (!targetDoutorId) {
                throw new Error("doutorId é obrigatório.");
            }
            // Verificar se o doutor está vinculado à secretária
            const vinculo = await prisma.secretariaDoutor.findFirst({
                where: {
                    secretariaId: user.id,
                    doutorId: targetDoutorId,
                },
            });
            if (!vinculo) {
                throw new Error("Acesso negado. Doutor não vinculado à secretária.");
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

        // Buscar doutor e serviço para validar horário de almoço
        const [doutorInfo, servico] = await Promise.all([
            (prisma.doutor.findFirst({ 
                where: { id: targetDoutorId, ativo: true },
                select: {
                    id: true,
                    nome: true,
                    email: true,
                    pausaInicio: true,
                    pausaFim: true,
                    diasBloqueados: true,
                } as any,
            }) as Promise<any>),
            prisma.servico.findFirst({ where: { id: servicoId, ativo: true } }),
        ]);

        if (!doutorInfo || !servico) {
            throw new Error("Doutor ou serviço não encontrado.");
        }

        // Validar se o agendamento não conflita com horário de almoço
        try {
            await this.validarHorarioAlmoco(dataHoraDate, servico.duracaoMin, doutorInfo.id, doutorInfo.pausaInicio, doutorInfo.pausaFim, doutorInfo.diasBloqueados);
        } catch (error: any) {
            throw new Error(error.message || "Não é possível agendar neste horário.");
        }

        const isEncaixe = data.isEncaixe || false;

        // Verificar conflitos com agendamentos existentes
        // Se não for encaixe, não permite conflitos
        if (!isEncaixe) {
            const conflito = await this.verificarConflitoHorario(dataHoraDate, servico.duracaoMin, targetDoutorId);
            if (conflito.temConflito) {
                throw new Error("Este horário já está ocupado por outro agendamento. Marque como 'Encaixe' se desejar agendar mesmo assim.");
            }
        }

        // Se for encaixe, usar status específico para encaixe pendente de confirmação
        const statusFinal = isEncaixe ? 'encaixe_pendente' : status;

        const novoAgendamento = await prisma.agendamento.create({
            data: {
                dataHora: dataHoraDate,
                status: statusFinal,
                pacienteId,
                doutorId: targetDoutorId,
                servicoId,
                isEncaixe,
                confirmadoPorMedico: isEncaixe ? false : undefined, // Encaixe precisa de confirmação do médico
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
        const [doutorInfo, paciente, servico] = await Promise.all([
            (prisma.doutor.findFirst({ 
                where: { id: doutorId, clinicaId, ativo: true },
                select: {
                    id: true,
                    nome: true,
                    email: true,
                    pausaInicio: true,
                    pausaFim: true,
                    diasBloqueados: true,
                } as any,
            }) as Promise<any>),
            prisma.paciente.findFirst({ where: { id: pacienteId, clinicaId, ativo: true } }),
            prisma.servico.findFirst({ where: { id: servicoId, clinicaId, ativo: true } }),
        ]);

        console.log(`[AgendamentoService.createParaIA] Resultado da validação:`, {
            doutor: doutorInfo ? `ID ${doutorInfo.id} - ${doutorInfo.nome}` : 'NÃO ENCONTRADO',
            paciente: paciente ? `ID ${paciente.id} - ${paciente.nome}` : 'NÃO ENCONTRADO',
            servico: servico ? `ID ${servico.id} - ${servico.nome}` : 'NÃO ENCONTRADO',
        });

        if (!doutorInfo || !paciente || !servico) {
            const erro = "Doutor, Paciente ou Serviço não encontrado ou não pertence à esta clínica.";
            console.error(`[AgendamentoService.createParaIA] ❌ ${erro}`);
            throw new Error(erro);
        }

        const dataHoraDate = typeof dataHora === 'string' ? new Date(dataHora) : dataHora;
        console.log(`[AgendamentoService.createParaIA] Data/hora processada:`, dataHoraDate);

        // Validar se o agendamento não conflita com horário de almoço
        try {
            await this.validarHorarioAlmoco(dataHoraDate, servico.duracaoMin, doutorInfo.id, doutorInfo.pausaInicio || null, doutorInfo.pausaFim || null, doutorInfo.diasBloqueados || null);
            console.log(`[AgendamentoService.createParaIA] ✅ Validação de horário de almoço passou`);
        } catch (error: any) {
            const erro = error.message || "Não é possível agendar no horário de almoço do doutor.";
            console.error(`[AgendamentoService.createParaIA] ❌ ${erro}`);
            throw new Error(erro);
        }

        const isEncaixe = data.isEncaixe || false;

        // Verificar conflitos com agendamentos existentes
        // Se não for encaixe, não permite conflitos
        if (!isEncaixe) {
            const conflito = await this.verificarConflitoHorario(dataHoraDate, servico.duracaoMin, doutorId);
            if (conflito.temConflito) {
                const erro = "Este horário já está ocupado por outro agendamento. A IA não pode criar encaixes automaticamente.";
                console.error(`[AgendamentoService.createParaIA] ❌ ${erro}`);
                throw new Error(erro);
            }
        }

        // Se for encaixe, usar status específico para encaixe pendente de confirmação
        const statusFinal = isEncaixe ? 'encaixe_pendente' : (status || 'pendente_ia');

        console.log(`[AgendamentoService.createParaIA] Criando agendamento no banco de dados...`);
        const novoAgendamento = await prisma.agendamento.create({
            data: {
                dataHora: dataHoraDate,
                status: statusFinal, // Status padrão para agendamentos da IA ou encaixe_pendente para encaixes
                pacienteId,
                doutorId,
                servicoId,
                relatoPaciente: relatoPaciente || undefined, // Salva o relato do paciente
                entendimentoIA: entendimentoIA || undefined, // Salva o entendimento da IA
                isEncaixe,
                confirmadoPorMedico: isEncaixe ? false : undefined, // Encaixe precisa de confirmação do médico
            } as any, // Type assertion temporária até regenerar Prisma Client
            include: agendamentoInclude,
        });

        console.log(`[AgendamentoService.createParaIA] ✅ Agendamento criado com sucesso - ID: ${novoAgendamento.id}`);

        // Formata a resposta
        const { doutor: doutorAgendamento, ...rest } = novoAgendamento;
        return {
            ...rest,
            doutor: {
                id: doutorAgendamento.id,
                nome: doutorAgendamento.nome,
                email: doutorAgendamento.email,
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
                ativo: true,
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
                ativo: true,
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
            } else if (user.role === 'SECRETARIA') {
                // Verificar se o novo doutor está vinculado à secretária
                const vinculo = await prisma.secretariaDoutor.findFirst({
                    where: {
                        secretariaId: user.id,
                        doutorId: data.doutorId,
                    },
                });
                if (!vinculo) {
                    throw new Error("Acesso negado. Doutor não vinculado à secretária.");
                }
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

        // Criar objeto de atualização apenas com campos válidos
        const updateData: any = {};
        let novaDataHora: Date | null = null;
        
        // Copiar apenas campos válidos para atualização
        if (data.dataHora !== undefined) {
            novaDataHora = typeof data.dataHora === 'string' ? new Date(data.dataHora) : data.dataHora;
            updateData.dataHora = novaDataHora;
        }
        if (data.status !== undefined) updateData.status = data.status;
        if (data.pacienteId !== undefined) updateData.pacienteId = data.pacienteId;
        if (data.doutorId !== undefined) updateData.doutorId = data.doutorId;
        if (data.servicoId !== undefined) updateData.servicoId = data.servicoId;
        if (data.isEncaixe !== undefined) updateData.isEncaixe = data.isEncaixe;
        if (data.motivoCancelamento !== undefined) updateData.motivoCancelamento = data.motivoCancelamento;

        // Se dataHora ou doutorId ou servicoId foram alterados, validar horário de almoço
        if (novaDataHora || data.doutorId || data.servicoId) {
            // Buscar doutor e serviço para validação
            const doutorValidado = await (prisma.doutor.findFirst({ 
                where: { id: targetDoutorId, ativo: true },
                select: {
                    id: true,
                    nome: true,
                    email: true,
                    pausaInicio: true,
                    pausaFim: true,
                    diasBloqueados: true,
                } as any,
            }) as Promise<any>);
            const servicoParaValidar = await prisma.servico.findFirst({ 
                where: { id: targetServicoId, ativo: true } 
            });

            if (!doutorValidado || !servicoParaValidar) {
                throw new Error("Doutor ou serviço não encontrado.");
            }

            const dataHoraParaValidar = novaDataHora || agendamentoExistente.dataHora;
            const duracaoParaValidar = data.servicoId ? servicoParaValidar.duracaoMin : agendamentoExistente.servico.duracaoMin;

            // Validar se o agendamento não conflita com horário de almoço
            try {
                await this.validarHorarioAlmoco(
                    dataHoraParaValidar,
                    duracaoParaValidar,
                    doutorValidado.id,
                    doutorValidado.pausaInicio || null,
                    doutorValidado.pausaFim || null,
                    doutorValidado.diasBloqueados || null
                );
            } catch (error: any) {
                throw new Error(error.message || "Não é possível agendar neste horário.");
            }

            // Verificar conflitos com agendamentos existentes
            const isEncaixe = data.isEncaixe ?? agendamentoExistente.isEncaixe ?? false;
            if (!isEncaixe) {
                const conflito = await this.verificarConflitoHorario(
                    dataHoraParaValidar,
                    duracaoParaValidar,
                    targetDoutorId,
                    id // Excluir o próprio agendamento da verificação
                );
                if (conflito.temConflito) {
                    throw new Error("Este horário já está ocupado por outro agendamento. Marque como 'Encaixe' se desejar agendar mesmo assim.");
                }
            }
        }

        // Se confirmadoPorMedico foi passado e o agendamento é encaixe
        if (data.confirmadoPorMedico !== undefined) {
            if (!agendamentoExistente.isEncaixe) {
                throw new Error("Apenas agendamentos de encaixe podem ser confirmados pelo médico.");
            }
            if (user.role !== 'DOUTOR' && user.role !== 'SUPER_ADMIN') {
                throw new Error("Apenas o médico pode confirmar agendamentos de encaixe.");
            }
            if (user.role === 'DOUTOR' && agendamentoExistente.doutorId !== user.id) {
                throw new Error("Acesso negado. Você só pode confirmar seus próprios agendamentos.");
            }
            updateData.confirmadoPorMedico = data.confirmadoPorMedico;
        }

        // Validações para cancelamento
        const estaCancelando = data.status === 'cancelado' && agendamentoExistente.status !== 'cancelado';
        if (estaCancelando) {
            // 1. Exigir motivo do cancelamento
            if (!data.motivoCancelamento || !data.motivoCancelamento.trim()) {
                throw new Error("O motivo do cancelamento é obrigatório.");
            }

            // 2. Verificar se o agendamento está no futuro (exceto para administradores)
            const agora = new Date();
            const dataHoraAgendamento = new Date(agendamentoExistente.dataHora);
            const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'CLINICA_ADMIN';
            
            if (!isAdmin && dataHoraAgendamento < agora) {
                throw new Error("Não é possível cancelar agendamentos retroativos. Apenas administradores podem cancelar agendamentos passados.");
            }

            // 3. Registrar motivo, responsável e data do cancelamento
            updateData.motivoCancelamento = data.motivoCancelamento.trim();
            updateData.canceladoPor = user.id;
            updateData.canceladoEm = new Date();
        }

        // Se não está cancelando mas está mudando de cancelado para outro status, limpar campos de cancelamento
        if (agendamentoExistente.status === 'cancelado' && data.status && data.status !== 'cancelado') {
            updateData.motivoCancelamento = undefined;
            updateData.canceladoPor = undefined;
            updateData.canceladoEm = undefined;
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

    async finalize(id: number, descricao: string, duracaoMinutos: number | undefined, user: AuthUser) {
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
            const historicoData: any = {
                pacienteId: atualizado.pacienteId,
                agendamentoId: atualizado.id,
                descricao: descricao.trim(),
                realizadoEm: new Date(atualizado.dataHora),
            };
            
            // Adicionar duracaoMinutos apenas se for um número válido
            if (duracaoMinutos !== undefined && duracaoMinutos !== null && !isNaN(Number(duracaoMinutos))) {
                historicoData.duracaoMinutos = Math.round(Number(duracaoMinutos));
            }
            
            await historicoDelegate.historicoPaciente.create({
                data: historicoData,
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

    /**
     * Confirma um agendamento de encaixe pelo médico
     */
    async confirmarEncaixe(id: number, user: AuthUser) {
        const agendamento = await prisma.agendamento.findUnique({
            where: { id },
            include: agendamentoInclude,
        });

        if (!agendamento) {
            throw new Error("Agendamento não encontrado.");
        }

        if (!agendamento.isEncaixe) {
            throw new Error("Este agendamento não é um encaixe.");
        }

        // Verificar acesso - apenas o médico dono do agendamento pode confirmar
        if (user.role === 'DOUTOR') {
            if (agendamento.doutorId !== user.id) {
                throw new Error("Acesso negado.");
            }
        } else if (user.role !== 'SUPER_ADMIN') {
            throw new Error("Apenas o médico pode confirmar agendamentos de encaixe.");
        }

        // Quando confirma encaixe, mudar status para "confirmado"
        const agendamentoAtualizado = await prisma.agendamento.update({
            where: { id },
            data: { 
                confirmadoPorMedico: true,
                status: 'confirmado', // Mudar status de encaixe_pendente para confirmado
            },
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

    async delete(id: number, user: AuthUser) {
        const agendamentoExistente = await prisma.agendamento.findUnique({
            where: { id },
            include: agendamentoInclude,
        });

        if (!agendamentoExistente) {
            throw new Error("Agendamento não encontrado.");
        }

        await this.ensureAccessToAgendamento(agendamentoExistente, user);

        await prisma.agendamento.update({
            where: { id },
            data: { ativo: false },
        });

        return { message: "Agendamento inativado com sucesso." };
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
        } else if (user.role === 'SECRETARIA') {
            // Verificar se o doutor do agendamento está vinculado à secretária
            if (!agendamento.doutorId) {
                throw new Error("Acesso negado. Agendamento sem doutor associado.");
            }
            const vinculo = await prisma.secretariaDoutor.findFirst({
                where: {
                    secretariaId: user.id,
                    doutorId: agendamento.doutorId,
                },
            });
            if (!vinculo) {
                throw new Error("Acesso negado. Doutor não vinculado à secretária.");
            }
        } else if (user.role !== 'SUPER_ADMIN') {
            throw new Error("Acesso negado.");
        }
    }

    private async ensureEntitiesBelongToClinica(params: { doutorId: number; pacienteId: number; servicoId: number; clinicaId: number; }) {
        const { doutorId, pacienteId, servicoId, clinicaId } = params;

        const [doutor, paciente, servico] = await Promise.all([
            prisma.doutor.findFirst({ where: { id: doutorId, clinicaId, ativo: true } }),
            prisma.paciente.findFirst({ where: { id: pacienteId, clinicaId, ativo: true } }),
            prisma.servico.findFirst({ where: { id: servicoId, clinicaId, ativo: true } }),
        ]);

        if (!doutor || !paciente || !servico) {
            throw new Error("Doutor, Paciente ou Serviço não encontrado ou não pertence à esta clínica.");
        }
    }

    private async ensureEntitiesExist(params: { doutorId: number; pacienteId: number; servicoId: number; }) {
        const { doutorId, pacienteId, servicoId } = params;

        const [doutor, paciente, servico] = await Promise.all([
            prisma.doutor.findFirst({ where: { id: doutorId, ativo: true } }),
            prisma.paciente.findFirst({ where: { id: pacienteId, ativo: true } }),
            prisma.servico.findFirst({ where: { id: servicoId, ativo: true } }),
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

