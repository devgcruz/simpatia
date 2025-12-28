import { prisma } from '../lib/prisma';
import * as pausaExcecaoService from './pausa-excecao.service';
import moment from 'moment-timezone';
import { BRAZIL_TZ } from '../utils/timezone';
import { emitAgendamentoEvent } from './websocket.service';

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
     * Converte minutos do dia para string de horário (ex: 780 -> "13:00")
     */
    private minutesToTime(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    /**
     * Verifica se dois intervalos se sobrepõem
     */
    private intervalsOverlap(
        start1: number,
        end1: number,
        start2: number,
        end2: number
    ): boolean {
        return start1 < end2 && start2 < end1;
    }

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
     * Verifica se um horário está bloqueado por indisponibilidade
     */
    private async verificarIndisponibilidade(
        dataHora: Date,
        duracaoMin: number,
        doutorId: number
    ): Promise<void> {
        // Calcular início e fim do agendamento
        const agendamentoInicio = moment(dataHora).tz(BRAZIL_TZ);
        const agendamentoFim = agendamentoInicio.clone().add(duracaoMin, 'minutes');

        // Buscar indisponibilidades ativas que se sobrepõem com o horário do agendamento
        const indisponibilidades = await prisma.indisponibilidade.findMany({
            where: {
                doutorId: doutorId,
                ativo: true,
                inicio: { lte: agendamentoFim.toDate() },
                fim: { gte: agendamentoInicio.toDate() },
            },
        });

        // Verificar se alguma indisponibilidade bloqueia o horário do agendamento
        for (const indisponibilidade of indisponibilidades) {
            const indisponibilidadeInicio = moment(indisponibilidade.inicio).tz(BRAZIL_TZ);
            const indisponibilidadeFim = moment(indisponibilidade.fim).tz(BRAZIL_TZ);

            // Verificar se há sobreposição entre o agendamento e a indisponibilidade
            // Um agendamento conflita se começa antes do fim da indisponibilidade E termina depois do início
            if (
                agendamentoInicio.isBefore(indisponibilidadeFim) &&
                indisponibilidadeInicio.isBefore(agendamentoFim)
            ) {
                const inicioStr = indisponibilidadeInicio.format('DD/MM/YYYY [às] HH:mm');
                const fimStr = indisponibilidadeFim.format('DD/MM/YYYY [às] HH:mm');
                throw new Error(`Este horário está bloqueado por uma indisponibilidade (${inicioStr} até ${fimStr}).`);
            }
        }
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

        // Buscar horário de trabalho do doutor para esse dia da semana
        // Se houver horário cadastrado com pausaInicio/pausaFim, usar esses valores
        // Senão, usar os valores padrão do doutor
        const horario = await prisma.horario.findFirst({
            where: {
                doutorId: doutorId,
                diaSemana: diaSemana,
                ativo: true,
            },
        });

        // Prioridade: 1. Exceção de pausa, 2. Horário do dia da semana, 3. Valores padrão do doutor
        let pausaInicioFinal = pausaInicioDefault;
        let pausaFimFinal = pausaFimDefault;

        // Se houver horário cadastrado para o dia com pausa, usar esses valores
        if (horario && horario.pausaInicio && horario.pausaFim) {
            pausaInicioFinal = horario.pausaInicio;
            pausaFimFinal = horario.pausaFim;
            console.log(`[validarHorarioAlmoco] Usando valores do horário do dia da semana: ${pausaInicioFinal} - ${pausaFimFinal}`);
        }

        // Buscar exceção de pausa para esta data específica
        const dataStr = dataHora.toISOString().split('T')[0] as string; // YYYY-MM-DD
        let excecaoPausa = null;
        if (typeof doutorId === 'number') {
            excecaoPausa = await pausaExcecaoService.findByDate(dataStr, undefined, doutorId);
        }
        
        // Se houver exceção de pausa, ela tem prioridade sobre tudo
        if (excecaoPausa) {
            pausaInicioFinal = excecaoPausa.pausaInicio;
            pausaFimFinal = excecaoPausa.pausaFim;
            console.log(`[validarHorarioAlmoco] Usando valores da exceção de pausa: ${pausaInicioFinal} - ${pausaFimFinal}`);
        }

        // Se não houver horário de almoço configurado, não há restrição
        if (!pausaInicioFinal || !pausaFimFinal) {
            return;
        }

        const pausaInicio = pausaInicioFinal;
        const pausaFim = pausaFimFinal;

        // Log para debug (remover em produção se necessário)
        console.log(`[validarHorarioAlmoco] ========== INÍCIO VALIDAÇÃO ==========`);
        console.log(`[validarHorarioAlmoco] doutorId=${doutorId}, dataStr=${dataStr}, diaSemana=${diaSemana}`);
        console.log(`[validarHorarioAlmoco] pausaInicioDefault="${pausaInicioDefault}", pausaFimDefault="${pausaFimDefault}"`);
        console.log(`[validarHorarioAlmoco] horario encontrado:`, horario ? `SIM (pausa: ${horario.pausaInicio || 'não'} - ${horario.pausaFim || 'não'})` : 'NÃO');
        console.log(`[validarHorarioAlmoco] excecaoPausa encontrada:`, excecaoPausa ? `SIM (${excecaoPausa.pausaInicio} - ${excecaoPausa.pausaFim})` : 'NÃO');
        console.log(`[validarHorarioAlmoco] valores finais: pausaInicio="${pausaInicio}", pausaFim="${pausaFim}"`);
        console.log(`[validarHorarioAlmoco] dataHora=${dataHora.toISOString()}, duracaoMin=${duracaoMin}`);
        
        // VALIDAÇÃO CRÍTICA: Verificar se os valores estão corretos
        if (pausaFim && pausaFim !== pausaFimDefault && !excecaoPausa) {
            console.error(`[validarHorarioAlmoco] ⚠️ ATENÇÃO: pausaFim (${pausaFim}) diferente de pausaFimDefault (${pausaFimDefault}) sem exceção!`);
        }
        
        // Validar que os valores de pausa estão no formato correto e são válidos
        if (pausaInicio && pausaFim) {
            // Validar formato (HH:MM)
            const formatoValido = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(pausaInicio) && /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(pausaFim);
            if (!formatoValido) {
                console.error(`[validarHorarioAlmoco] ⚠️ ERRO: Formato de horário inválido! pausaInicio="${pausaInicio}", pausaFim="${pausaFim}"`);
                throw new Error(`Horário de pausa inválido. Formato esperado: HH:MM`);
            }
            
            const inicioParts = pausaInicio.split(':').map(Number);
            const fimParts = pausaFim.split(':').map(Number);
            const inicioH = inicioParts[0] ?? 0;
            const inicioM = inicioParts[1] ?? 0;
            const fimH = fimParts[0] ?? 0;
            const fimM = fimParts[1] ?? 0;
            const inicioMin = inicioH * 60 + inicioM;
            const fimMin = fimH * 60 + fimM;
            
            if (fimMin <= inicioMin) {
                console.error(`[validarHorarioAlmoco] ⚠️ ERRO: Intervalo de pausa inválido! pausaFim (${pausaFim}) deve ser maior que pausaInicio (${pausaInicio})`);
                throw new Error(`Horário de pausa inválido. O horário de fim (${pausaFim}) deve ser maior que o horário de início (${pausaInicio}).`);
            }
            
            // VALIDAÇÃO ADICIONAL: Verificar se o intervalo de pausa parece muito longo (pode indicar erro de cadastro)
            const duracaoPausa = fimMin - inicioMin;
            if (duracaoPausa > 120) {
                console.warn(`[validarHorarioAlmoco] ⚠️ AVISO: Intervalo de pausa muito longo (${duracaoPausa} minutos = ${Math.floor(duracaoPausa / 60)}h${duracaoPausa % 60}min). Verifique se os valores estão corretos.`);
            }
        }

        // Converter horários para minutos do dia
        const pausaInicioParts = pausaInicio.split(':').map(Number);
        const pausaFimParts = pausaFim.split(':').map(Number);
        const pausaInicioH = pausaInicioParts[0] ?? 0;
        const pausaInicioM = pausaInicioParts[1] ?? 0;
        const pausaFimH = pausaFimParts[0] ?? 0;
        const pausaFimM = pausaFimParts[1] ?? 0;
        
        const pausaInicioMinutos = pausaInicioH * 60 + pausaInicioM;
        const pausaFimMinutos = pausaFimH * 60 + pausaFimM;

        // Calcular horário de início e fim do agendamento em minutos do dia
        const agendamentoInicioMinutos = dataHora.getHours() * 60 + dataHora.getMinutes();
        const agendamentoFimMinutos = agendamentoInicioMinutos + duracaoMin;

        // Log para debug
        console.log(`[validarHorarioAlmoco] pausaInicioMinutos=${pausaInicioMinutos} (${pausaInicio}), pausaFimMinutos=${pausaFimMinutos} (${pausaFim})`);
        console.log(`[validarHorarioAlmoco] agendamentoInicioMinutos=${agendamentoInicioMinutos}, agendamentoFimMinutos=${agendamentoFimMinutos}`);

        // Verificar se há sobreposição entre agendamento e horário de almoço
        // Regras:
        // 1. O agendamento não pode começar durante a pausa (mas pode começar exatamente quando termina)
        // 2. O agendamento não pode terminar durante a pausa (mas pode terminar exatamente quando começa ou quando termina)
        // 3. O agendamento não pode envolver completamente a pausa
        // IMPORTANTE: 
        // - Um agendamento que começa exatamente quando a pausa termina (ex: pausa 12:00-13:00, agendamento 13:00) NÃO conflita
        // - Um agendamento que termina exatamente quando a pausa começa (ex: pausa 12:00-13:00, agendamento 11:30-12:00) NÃO conflita
        // - Um agendamento que termina exatamente quando a pausa termina (ex: pausa 12:00-13:00, agendamento 12:30-13:00) NÃO conflita
        // - A pausa é EXCLUSIVA: 12:00-13:00 significa pausa de 12:00 até 12:59:59, então 13:00 já está livre
        
        // Verificar cada condição separadamente para melhor debug
        const condicao1 = agendamentoInicioMinutos >= pausaInicioMinutos && agendamentoInicioMinutos < pausaFimMinutos;
        const condicao2 = agendamentoFimMinutos > pausaInicioMinutos && agendamentoFimMinutos < pausaFimMinutos;
        const condicao3 = agendamentoInicioMinutos < pausaInicioMinutos && agendamentoFimMinutos > pausaFimMinutos;
        
        const conflita = condicao1 || condicao2 || condicao3;
        
        console.log(`[validarHorarioAlmoco] Análise de conflito:`);
        console.log(`[validarHorarioAlmoco]   - Agendamento: ${this.minutesToTime(agendamentoInicioMinutos)} até ${this.minutesToTime(agendamentoFimMinutos)}`);
        console.log(`[validarHorarioAlmoco]   - Pausa: ${pausaInicio} até ${pausaFim}`);
        console.log(`[validarHorarioAlmoco]   - Condição 1 (começa durante): ${condicao1} (${agendamentoInicioMinutos} >= ${pausaInicioMinutos} && ${agendamentoInicioMinutos} < ${pausaFimMinutos})`);
        console.log(`[validarHorarioAlmoco]   - Condição 2 (termina durante): ${condicao2} (${agendamentoFimMinutos} > ${pausaInicioMinutos} && ${agendamentoFimMinutos} < ${pausaFimMinutos})`);
        console.log(`[validarHorarioAlmoco]   - Condição 3 (envolve completamente): ${condicao3} (${agendamentoInicioMinutos} < ${pausaInicioMinutos} && ${agendamentoFimMinutos} > ${pausaFimMinutos})`);

        console.log(`[validarHorarioAlmoco] conflita=${conflita}`);
        console.log(`[validarHorarioAlmoco] ========== FIM VALIDAÇÃO ==========`);

        if (conflita) {
            // Usar os valores originais (pausaInicio e pausaFim) na mensagem de erro para garantir que mostra os valores corretos
            // Garantir que os valores estão no formato correto (HH:MM)
            const pausaInicioFormatado = pausaInicio || 'não definido';
            const pausaFimFormatado = pausaFim || 'não definido';
            const mensagemErro = `Não é possível agendar no horário de almoço do doutor (${pausaInicioFormatado} às ${pausaFimFormatado}).`;
            console.error(`[validarHorarioAlmoco] ❌ ERRO: ${mensagemErro}`);
            console.error(`[validarHorarioAlmoco] Valores usados: pausaInicio="${pausaInicio}", pausaFim="${pausaFim}"`);
            console.error(`[validarHorarioAlmoco] Valores padrão: pausaInicioDefault="${pausaInicioDefault}", pausaFimDefault="${pausaFimDefault}"`);
            if (excecaoPausa) {
                console.error(`[validarHorarioAlmoco] Exceção de pausa: pausaInicio="${excecaoPausa.pausaInicio}", pausaFim="${excecaoPausa.pausaFim}"`);
            }
            throw new Error(mensagemErro);
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

        // Validar indisponibilidade
        try {
            await this.verificarIndisponibilidade(dataHoraDate, servico.duracaoMin, targetDoutorId);
        } catch (error: any) {
            throw new Error(error.message || "Este horário está bloqueado por indisponibilidade.");
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
                ...(isEncaixe && { confirmadoPorMedico: false }), // Encaixe precisa de confirmação do médico
            },
            include: agendamentoInclude,
        });

        // Garantir que temos o objeto completo com todas as relações
        // Se o Prisma não retornou as relações, fazer um findUnique para garantir
        let agendamentoCompleto = novoAgendamento;
        if (!novoAgendamento.paciente || !novoAgendamento.doutor || !novoAgendamento.servico) {
            agendamentoCompleto = await prisma.agendamento.findUnique({
                where: { id: novoAgendamento.id },
                include: agendamentoInclude,
            }) || novoAgendamento;
        }

        // Emitir evento WebSocket com objeto completo (Rich Payload)
        const agendamentoDoutorId = agendamentoCompleto.doutorId || agendamentoCompleto.doutor?.id;
        const agendamentoClinicaId = user.clinicaId || agendamentoCompleto.doutor?.clinicaId;
        
        if (agendamentoDoutorId && agendamentoClinicaId) {
            emitAgendamentoEvent({
                id: agendamentoCompleto.id,
                doutorId: agendamentoDoutorId,
                clinicaId: agendamentoClinicaId,
                action: 'created',
                agendamento: agendamentoCompleto, // Objeto completo com todas as relações
            });
        }

        // Retornar agendamento completo com todos os relacionamentos
        return agendamentoCompleto;
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

        // Validar indisponibilidade
        try {
            await this.verificarIndisponibilidade(dataHoraDate, servico.duracaoMin, doutorId);
            console.log(`[AgendamentoService.createParaIA] ✅ Validação de indisponibilidade passou`);
        } catch (error: any) {
            const erro = error.message || "Este horário está bloqueado por indisponibilidade.";
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
                ...(isEncaixe && { confirmadoPorMedico: false }), // Encaixe precisa de confirmação do médico
            } as any, // Type assertion temporária até regenerar Prisma Client
            include: agendamentoInclude,
        });

        console.log(`[AgendamentoService.createParaIA] ✅ Agendamento criado com sucesso - ID: ${novoAgendamento.id}`);

        // Garantir que temos o objeto completo com todas as relações
        // Se o Prisma não retornou as relações, fazer um findUnique para garantir
        let agendamentoCompleto = novoAgendamento;
        if (!novoAgendamento.paciente || !novoAgendamento.doutor || !novoAgendamento.servico) {
            agendamentoCompleto = await prisma.agendamento.findUnique({
                where: { id: novoAgendamento.id },
                include: agendamentoInclude,
            }) || novoAgendamento;
        }

        // Emitir evento WebSocket com objeto completo (Rich Payload)
        const agendamentoDoutorId = agendamentoCompleto.doutorId || agendamentoCompleto.doutor?.id;
        
        if (agendamentoDoutorId && clinicaId) {
            emitAgendamentoEvent({
                id: agendamentoCompleto.id,
                doutorId: agendamentoDoutorId,
                clinicaId: clinicaId,
                action: 'created',
                agendamento: agendamentoCompleto, // Objeto completo com todas as relações
            });
        }

        // Formata a resposta para retorno da API
        const { doutor: doutorAgendamento, ...rest } = agendamentoCompleto;
        const agendamentoFormatado = {
            ...rest,
            doutor: {
                id: doutorAgendamento.id,
                nome: doutorAgendamento.nome,
                email: doutorAgendamento.email,
            },
        };

        return agendamentoFormatado;
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

        // Garantir que temos o objeto completo com todas as relações
        // Se o Prisma não retornou as relações, fazer um findUnique para garantir
        let agendamentoCompleto = agendamentoCancelado;
        if (!agendamentoCancelado.paciente || !agendamentoCancelado.doutor || !agendamentoCancelado.servico) {
            agendamentoCompleto = await prisma.agendamento.findUnique({
                where: { id: agendamentoId },
                include: agendamentoInclude,
            }) || agendamentoCancelado;
        }

        // Emitir evento WebSocket com objeto completo (Rich Payload)
        const agendamentoDoutorId = agendamentoCompleto.doutorId || agendamentoCompleto.doutor?.id;
        const agendamentoClinicaId = clinicaId || agendamentoCompleto.doutor?.clinicaId;
        
        if (agendamentoDoutorId && agendamentoClinicaId) {
            emitAgendamentoEvent({
                id: agendamentoCompleto.id,
                doutorId: agendamentoDoutorId,
                clinicaId: agendamentoClinicaId,
                action: 'canceled',
                agendamento: agendamentoCompleto, // Objeto completo com todas as relações
            });
        }

        const { doutor, ...rest } = agendamentoCompleto;
        const agendamentoFormatado = {
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        };

        return agendamentoFormatado;
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

            // VALIDAÇÃO DUPLA PARA REMARCAÇÃO
            // Se a dataHora está sendo alterada, validar tanto o horário antigo quanto o novo
            const estaRemarcando = novaDataHora && 
                novaDataHora.getTime() !== new Date(agendamentoExistente.dataHora).getTime();
            
            if (estaRemarcando) {
                const dataHoraAntiga = new Date(agendamentoExistente.dataHora);
                const duracaoAntiga = agendamentoExistente.servico.duracaoMin;
                const doutorIdAntigo = agendamentoExistente.doutorId;

                // 1. VALIDAR HORÁRIO ANTIGO: Verificar se não há conflitos temporários
                // Verificar se há outros agendamentos que podem conflitar com o horário antigo
                // durante a transição (caso o novo horário já esteja ocupado)
                const conflitoHorarioAntigo = await this.verificarConflitoHorario(
                    dataHoraAntiga,
                    duracaoAntiga,
                    doutorIdAntigo,
                    id // Excluir o próprio agendamento
                );
                
                // Se o doutor mudou, verificar conflitos no doutor antigo também
                if (targetDoutorId !== doutorIdAntigo) {
                    // Verificar se há conflitos no horário antigo do doutor antigo
                    // (para garantir que não estamos criando um buraco problemático)
                    const conflitoDoutorAntigo = await this.verificarConflitoHorario(
                        dataHoraAntiga,
                        duracaoAntiga,
                        doutorIdAntigo,
                        id
                    );
                    // Nota: Este é mais uma verificação de integridade, não um bloqueio
                }

                // 2. VALIDAR HORÁRIO NOVO: Verificar disponibilidade do novo horário
                // Validar horário de almoço para o novo horário
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
                    throw new Error(`Não é possível remarcar para este horário: ${error.message || "Horário inválido."}`);
                }

                // Validar indisponibilidade para o novo horário
                try {
                    await this.verificarIndisponibilidade(
                        dataHoraParaValidar,
                        duracaoParaValidar,
                        targetDoutorId
                    );
                } catch (error: any) {
                    throw new Error(`Não é possível remarcar para este horário: ${error.message || "Horário bloqueado por indisponibilidade."}`);
                }

                // Verificar conflitos com agendamentos existentes no novo horário
                const isEncaixe = data.isEncaixe ?? agendamentoExistente.isEncaixe ?? false;
                if (!isEncaixe) {
                    const conflitoNovoHorario = await this.verificarConflitoHorario(
                        dataHoraParaValidar,
                        duracaoParaValidar,
                        targetDoutorId,
                        id // Excluir o próprio agendamento da verificação
                    );
                    
                    if (conflitoNovoHorario.temConflito) {
                        const agendamentosConflitantes = conflitoNovoHorario.agendamentosConflitantes;
                        const detalhesConflito = agendamentosConflitantes.length > 0
                            ? ` Conflito com agendamento(s) existente(s).`
                            : '';
                        throw new Error(`Este horário já está ocupado por outro agendamento.${detalhesConflito} Marque como 'Encaixe' se desejar agendar mesmo assim.`);
                    }
                }

                // 3. GARANTIR QUE NÃO HÁ CONFLITOS TEMPORÁRIOS
                // Verificar se o novo horário não conflita com o horário antigo (mesmo dia, horários sobrepostos)
                const mesmoDia = dataHoraParaValidar.toDateString() === dataHoraAntiga.toDateString();
                if (mesmoDia && targetDoutorId === doutorIdAntigo) {
                    const inicioAntigo = dataHoraAntiga.getHours() * 60 + dataHoraAntiga.getMinutes();
                    const fimAntigo = inicioAntigo + duracaoAntiga;
                    const inicioNovo = dataHoraParaValidar.getHours() * 60 + dataHoraParaValidar.getMinutes();
                    const fimNovo = inicioNovo + duracaoParaValidar;

                    // Verificar se há sobreposição entre os horários antigo e novo
                    if (this.intervalsOverlap(inicioAntigo, fimAntigo, inicioNovo, fimNovo)) {
                        throw new Error("O novo horário não pode sobrepor o horário atual do agendamento. Escolha um horário diferente.");
                    }
                }
            } else {
                // Se não está remarcando (apenas mudando doutor ou serviço), validar normalmente
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

                // Validar indisponibilidade
                try {
                    await this.verificarIndisponibilidade(
                        dataHoraParaValidar,
                        duracaoParaValidar,
                        targetDoutorId
                    );
                } catch (error: any) {
                    throw new Error(error.message || "Este horário está bloqueado por indisponibilidade.");
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

        // Garantir que temos o objeto completo com todas as relações
        // Se o Prisma não retornou as relações, fazer um findUnique para garantir
        let agendamentoCompleto = agendamentoAtualizado;
        if (!agendamentoAtualizado.paciente || !agendamentoAtualizado.doutor || !agendamentoAtualizado.servico) {
            agendamentoCompleto = await prisma.agendamento.findUnique({
                where: { id },
                include: agendamentoInclude,
            }) || agendamentoAtualizado;
        }

        // Emitir evento WebSocket com objeto completo (Rich Payload)
        const agendamentoDoutorId = agendamentoCompleto.doutorId || agendamentoCompleto.doutor?.id;
        const agendamentoClinicaId = user.clinicaId || agendamentoCompleto.doutor?.clinicaId;
        
        if (agendamentoDoutorId && agendamentoClinicaId) {
            emitAgendamentoEvent({
                id: agendamentoCompleto.id,
                doutorId: agendamentoDoutorId,
                clinicaId: agendamentoClinicaId,
                action: 'updated',
                agendamento: agendamentoCompleto, // Objeto completo com todas as relações
            });
        }

        const { doutor, ...rest } = agendamentoCompleto;
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

        // Garantir que temos o objeto completo com todas as relações
        // Se o Prisma não retornou as relações, fazer um findUnique para garantir
        let agendamentoCompleto = agendamentoFinalizado;
        if (!agendamentoFinalizado.paciente || !agendamentoFinalizado.doutor || !agendamentoFinalizado.servico) {
            agendamentoCompleto = await prisma.agendamento.findUnique({
                where: { id },
                include: agendamentoInclude,
            }) || agendamentoFinalizado;
        }

        // Emitir evento WebSocket com objeto completo (Rich Payload)
        const agendamentoDoutorId = agendamentoCompleto.doutorId || agendamentoCompleto.doutor?.id;
        const agendamentoClinicaId = user.clinicaId || agendamentoCompleto.doutor?.clinicaId;
        
        if (agendamentoDoutorId && agendamentoClinicaId) {
            emitAgendamentoEvent({
                id: agendamentoCompleto.id,
                doutorId: agendamentoDoutorId,
                clinicaId: agendamentoClinicaId,
                action: 'finalized',
                agendamento: agendamentoCompleto, // Objeto completo com todas as relações
            });
        }

        const { doutor, ...rest } = agendamentoCompleto;
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

        // Garantir que temos o objeto completo com todas as relações
        // Se o Prisma não retornou as relações, fazer um findUnique para garantir
        let agendamentoCompleto = agendamentoAtualizado;
        if (!agendamentoAtualizado.paciente || !agendamentoAtualizado.doutor || !agendamentoAtualizado.servico) {
            agendamentoCompleto = await prisma.agendamento.findUnique({
                where: { id },
                include: agendamentoInclude,
            }) || agendamentoAtualizado;
        }

        // Emitir evento WebSocket com objeto completo (Rich Payload)
        const agendamentoDoutorId = agendamentoCompleto.doutorId || agendamentoCompleto.doutor?.id;
        const agendamentoClinicaId = agendamentoCompleto.doutor?.clinicaId;
        
        if (agendamentoDoutorId && agendamentoClinicaId) {
            emitAgendamentoEvent({
                id: agendamentoCompleto.id,
                doutorId: agendamentoDoutorId,
                clinicaId: agendamentoClinicaId,
                action: 'encaixe_confirmed',
                agendamento: agendamentoCompleto, // Objeto completo com todas as relações
            });
        }

        const { doutor, ...rest } = agendamentoCompleto;
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

