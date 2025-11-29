import { prisma } from '../lib/prisma';
import moment from 'moment-timezone';
import { BRAZIL_TZ, parseBrazilDate, BrazilMoment } from '../utils/timezone';

const MINUTES_IN_DAY = 24 * 60;

class DisponibilidadeService {

    // Converte horário string (ex: "08:00") para minutos desde meia-noite
    private timeToMinutes(time: string): number {
        const parts = time.split(':');
        const hours = parseInt(parts[0] || '0', 10);
        const minutes = parseInt(parts[1] || '0', 10);
        return hours * 60 + minutes;
    }

    // Converte minutos desde meia-noite para string de horário (ex: "08:00")
    private minutesToTime(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    // Verifica se dois intervalos se sobrepõem
    private intervalsOverlap(
        start1: number,
        end1: number,
        start2: number,
        end2: number
    ): boolean {
        return start1 < end2 && start2 < end1;
    }

    // Verifica se um horário está dentro do intervalo de pausa
    private isInPauseTime(
        slotStart: number,
        slotEnd: number,
        pauseStart: number | null,
        pauseEnd: number | null
    ): boolean {
        if (!pauseStart || !pauseEnd) return false;
        return this.intervalsOverlap(slotStart, slotEnd, pauseStart, pauseEnd);
    }

    async getDisponibilidade(
        user: { id: number; role: string; clinicaId: number },
        doutorId: number,
        servicoId: number,
        data: string
    ): Promise<string[]> {
        const servico = await prisma.servico.findFirst({
            where: { id: servicoId, clinicaId: user.clinicaId, ativo: true },
        });

        const doutor = await prisma.doutor.findFirst({
            where: { id: doutorId, clinicaId: user.clinicaId, ativo: true },
        });

        if (!servico || !doutor) {
            throw new Error("Serviço ou Doutor não encontrado ou não pertence à esta clínica.");
        }

        const dataMoment = parseBrazilDate(data);
        const diaSemana = dataMoment.day(); // 0 = Domingo, 1 = Segunda, etc.
        const dayStart = dataMoment.clone().startOf('day');
        const dayEnd = dayStart.clone().endOf('day');

        const duracaoMin = servico.duracaoMin;

        // Buscar horário de trabalho do doutor para esse dia
        const horario = await prisma.horario.findFirst({
            where: {
                doutorId: doutorId,
                diaSemana: diaSemana,
            },
        });

        // Se não houver horário de trabalho para esse dia, retornar lista vazia
        if (!horario) {
            return [];
        }

        // Converter horários para minutos
        const inicioMin = this.timeToMinutes(horario.inicio);
        const fimMin = this.timeToMinutes(horario.fim);
        const pausaInicioMin = horario.pausaInicio ? this.timeToMinutes(horario.pausaInicio) : null;
        const pausaFimMin = horario.pausaFim ? this.timeToMinutes(horario.pausaFim) : null;

        // Buscar agendamentos do doutor nesse dia
        const inicioDia = dayStart.toDate();
        const fimDia = dayEnd.toDate();

        const agendamentos = await prisma.agendamento.findMany({
            where: {
                doutorId: doutorId,
                dataHora: {
                    gte: inicioDia,
                    lte: fimDia,
                },
                // Considerar apenas agendamentos confirmados ou pendentes (não cancelados) e ativos
                status: {
                    not: 'cancelado'
                },
                ativo: true,
            },
            include: {
                servico: true,
            },
        });

        const bloqueiosIndisponibilidade = await this.getIndisponibilidadeBloqueios(doutorId, inicioDia, fimDia, dayStart);

        // Gerar lista de slots possíveis
        const slots: string[] = [];
        let currentMin = inicioMin;

        while (currentMin + duracaoMin <= fimMin) {
            const slotEndMin = currentMin + duracaoMin;
            const slotTime = this.minutesToTime(currentMin);

            // Verificar se o slot está dentro do horário de pausa
            if (this.isInPauseTime(currentMin, slotEndMin, pausaInicioMin, pausaFimMin)) {
                // Se o slot está na pausa, pular para depois da pausa
                if (pausaFimMin) {
                    currentMin = pausaFimMin;
                    continue;
                }
            }

            // Verificar se o slot se sobrepõe com algum agendamento existente
            let disponivel = true;
            for (const agendamento of agendamentos) {
                const agendamentoDataHora = new Date(agendamento.dataHora);
                const agendamentoHora = agendamentoDataHora.getHours();
                const agendamentoMin = agendamentoDataHora.getMinutes();
                const agendamentoStartMin = agendamentoHora * 60 + agendamentoMin;
                const agendamentoDuracao = agendamento.servico.duracaoMin;
                const agendamentoEndMin = agendamentoStartMin + agendamentoDuracao;

                if (this.intervalsOverlap(
                    currentMin,
                    slotEndMin,
                    agendamentoStartMin,
                    agendamentoEndMin
                )) {
                    disponivel = false;
                    break;
                }
            }

            if (disponivel && this.isSlotBlocked(currentMin, bloqueiosIndisponibilidade)) {
                disponivel = false;
            }

            if (disponivel) {
                slots.push(slotTime);
            }

            // Avançar para o próximo slot (usar duração do serviço como intervalo)
            currentMin += duracaoMin;
        }

        // Garantir que os horários estão ordenados (primeiros primeiro)
        slots.sort((a, b) => {
            const partesA = a.split(':');
            const partesB = b.split(':');
            const hA = parseInt(partesA[0] || '0', 10);
            const mA = parseInt(partesA[1] || '0', 10);
            const hB = parseInt(partesB[0] || '0', 10);
            const mB = parseInt(partesB[1] || '0', 10);
            return (hA * 60 + mA) - (hB * 60 + mB);
        });

        return slots;
    }

    async getDisponibilidadeParaIA(
        clinicaId: number,
        doutorId: number,
        servicoId: number,
        data: string
    ): Promise<string[]> {
        console.log(`[DisponibilidadeService] Verificando disponibilidade - doutorId: ${doutorId}, servicoId: ${servicoId}, data: ${data}, clinicaId: ${clinicaId}`);
        
        console.log(`[DisponibilidadeService] 🔍 Buscando serviço: id=${servicoId}, clinicaId=${clinicaId}`);
        const servico = await prisma.servico.findFirst({
            where: { id: servicoId, clinicaId, ativo: true },
        });
        console.log(`[DisponibilidadeService] 🔍 Serviço encontrado: ${servico ? `SIM (id=${servico.id}, nome="${servico.nome}", clinicaId=${servico.clinicaId})` : 'NÃO'}`);

        console.log(`[DisponibilidadeService] 🔍 Buscando doutor: id=${doutorId}, clinicaId=${clinicaId}`);
        const doutor = await prisma.doutor.findFirst({
            where: { id: doutorId, clinicaId, ativo: true },
        });
        
        // Se não encontrou com filtro de clinicaId, verificar se existe sem filtro
        if (!doutor) {
            console.warn(`[DisponibilidadeService] ⚠️ Doutor ${doutorId} não encontrado com filtro clinicaId=${clinicaId}`);
            const doutorSemFiltro = await prisma.doutor.findFirst({
                where: { id: doutorId, ativo: true },
            });
            if (doutorSemFiltro) {
                console.warn(`[DisponibilidadeService] ⚠️ Doutor ${doutorId} existe, mas pertence à clínica ${doutorSemFiltro.clinicaId || 'NENHUMA (null)'}, não à clínica ${clinicaId}`);
                console.warn(`[DisponibilidadeService] ⚠️ Dados do doutor encontrado:`, {
                    id: doutorSemFiltro.id,
                    nome: doutorSemFiltro.nome,
                    email: doutorSemFiltro.email,
                    clinicaId: doutorSemFiltro.clinicaId
                });
            } else {
                console.error(`[DisponibilidadeService] ❌ Doutor ${doutorId} não existe no banco de dados`);
            }
        } else {
            console.log(`[DisponibilidadeService] ✅ Doutor encontrado: id=${doutor.id}, nome="${doutor.nome}", clinicaId=${doutor.clinicaId}`);
        }

        if (!servico || !doutor) {
            console.error(`[DisponibilidadeService] ❌ Serviço ou Doutor não encontrado - servico: ${servico ? 'OK' : 'NÃO ENCONTRADO'}, doutor: ${doutor ? 'OK' : 'NÃO ENCONTRADO'}`);
            throw new Error("Serviço ou Doutor não encontrado ou não pertence à esta clínica.");
        }

        const dataMoment = parseBrazilDate(data);
        const diaSemana = dataMoment.day();
        const dayStart = dataMoment.clone().startOf('day');
        const dayEnd = dayStart.clone().endOf('day');
        console.log(`[DisponibilidadeService] Data processada: entrada="${data}", interpretada como ${dayStart.format('DD/MM/YYYY')} (dia da semana: ${diaSemana})`);

        const duracaoMin = servico.duracaoMin;
        console.log(`[DisponibilidadeService] Duração do serviço: ${duracaoMin} minutos`);

        const horario = await prisma.horario.findFirst({
            where: {
                doutorId,
                diaSemana,
            },
        });

        // Se não houver horário cadastrado, usar horários padrão (09:00 até 18:00)
        // A lógica é: se não há agendamento em um horário, aquele horário está livre
        let inicioMin: number;
        let fimMin: number;
        let pausaInicioMin: number | null = null;
        let pausaFimMin: number | null = null;
        let usandoHorarioPadrao = false;

        if (!horario) {
            console.warn(`[DisponibilidadeService] ⚠️ Nenhum horário cadastrado para o doutor ${doutorId} no dia da semana ${diaSemana}`);
            console.log(`[DisponibilidadeService] 🔄 Usando horários padrão: 09:00 - 18:00 (verificando apenas agendamentos existentes)`);
            usandoHorarioPadrao = true;
            // Horários padrão: 09:00 até 18:00
            inicioMin = this.timeToMinutes('09:00');
            fimMin = this.timeToMinutes('18:00');
        } else {
            console.log(`[DisponibilidadeService] Horário encontrado: ${horario.inicio} - ${horario.fim} (pausa: ${horario.pausaInicio || 'não'} - ${horario.pausaFim || 'não'})`);
            inicioMin = this.timeToMinutes(horario.inicio);
            fimMin = this.timeToMinutes(horario.fim);
            pausaInicioMin = horario.pausaInicio ? this.timeToMinutes(horario.pausaInicio) : null;
            pausaFimMin = horario.pausaFim ? this.timeToMinutes(horario.pausaFim) : null;
        }

        const inicioDia = dayStart.toDate();
        const fimDia = dayEnd.toDate();

        const agendamentos = await prisma.agendamento.findMany({
            where: {
                doutorId,
                dataHora: {
                    gte: inicioDia,
                    lte: fimDia,
                },
                status: {
                    not: 'cancelado',
                },
                ativo: true,
            },
            include: {
                servico: true,
            },
        });

        console.log(`[DisponibilidadeService] Agendamentos encontrados para o dia: ${agendamentos.length}`);
        const bloqueiosIndisponibilidade = await this.getIndisponibilidadeBloqueios(doutorId, inicioDia, fimDia, dayStart);
        console.log(`[DisponibilidadeService] Indisponibilidades encontradas para o dia: ${bloqueiosIndisponibilidade.length}`);
        if (agendamentos.length > 0) {
            console.log(`[DisponibilidadeService] Agendamentos:`, agendamentos.map(a => ({
                hora: new Date(a.dataHora).toLocaleTimeString('pt-BR'),
                servico: a.servico.nome,
                duracao: a.servico.duracaoMin
            })));
        }

        const slots: string[] = [];
        let currentMin = inicioMin;
        
        // Intervalo de slots: usar 15 minutos para gerar mais opções e ocupar melhor a agenda
        // Isso permite slots mais próximos e melhor aproveitamento
        // Se estiver usando horário padrão, usar intervalo maior (30 min ou duração do serviço)
        const intervaloSlot = usandoHorarioPadrao ? Math.max(duracaoMin, 30) : 15; // minutos entre cada slot
        
        console.log(`[DisponibilidadeService] Gerando slots de ${this.minutesToTime(inicioMin)} até ${this.minutesToTime(fimMin)} com intervalo de ${intervaloSlot} minutos${usandoHorarioPadrao ? ' (horário padrão)' : ''}`);

        while (currentMin + duracaoMin <= fimMin) {
            const slotEndMin = currentMin + duracaoMin;
            const slotTime = this.minutesToTime(currentMin);

            // Verificar se o slot está dentro do horário de pausa (apenas se não estiver usando horário padrão)
            if (!usandoHorarioPadrao && this.isInPauseTime(currentMin, slotEndMin, pausaInicioMin, pausaFimMin)) {
                if (pausaFimMin) {
                    currentMin = pausaFimMin;
                    continue;
                }
            }

            let disponivel = true;
            for (const agendamento of agendamentos) {
                const agendamentoDataHora = new Date(agendamento.dataHora);
                const agendamentoHora = agendamentoDataHora.getHours();
                const agendamentoMin = agendamentoDataHora.getMinutes();
                const agendamentoStartMin = agendamentoHora * 60 + agendamentoMin;
                const agendamentoDuracao = agendamento.servico.duracaoMin;
                const agendamentoEndMin = agendamentoStartMin + agendamentoDuracao;

                if (this.intervalsOverlap(
                    currentMin,
                    slotEndMin,
                    agendamentoStartMin,
                    agendamentoEndMin
                )) {
                    disponivel = false;
                    break;
                }
            }

            if (disponivel && this.isSlotBlocked(currentMin, bloqueiosIndisponibilidade)) {
                disponivel = false;
            }

            if (disponivel) {
                slots.push(slotTime);
            }

            // Avançar em intervalos menores (15 min) para gerar mais slots e ocupar melhor a agenda
            currentMin += intervaloSlot;
        }

        // Garantir que os horários estão ordenados (primeiros primeiro)
        slots.sort((a, b) => {
            const partesA = a.split(':');
            const partesB = b.split(':');
            const hA = parseInt(partesA[0] || '0', 10);
            const mA = parseInt(partesA[1] || '0', 10);
            const hB = parseInt(partesB[0] || '0', 10);
            const mB = parseInt(partesB[1] || '0', 10);
            return (hA * 60 + mA) - (hB * 60 + mB);
        });

        const agora = moment().tz(BRAZIL_TZ);
        const slotsFuturos = slots.filter((slot) => {
            const [horaStr, minutoStr] = slot.split(':');
            const horaSlot = parseInt(horaStr || '0', 10);
            const minutoSlot = parseInt(minutoStr || '0', 10);
            const minutosSlot = horaSlot * 60 + minutoSlot;

            if (dayStart.isSame(agora, 'day')) {
                const minutosAtuais = agora.hours() * 60 + agora.minutes();
                if (minutosSlot < minutosAtuais + 30) {
                    return false;
                }
            }

            return true;
        });

        console.log(`[DisponibilidadeService] ✅ Total de slots disponíveis gerados: ${slots.length}${usandoHorarioPadrao ? ' (usando horário padrão)' : ''}`);
        if (slots.length !== slotsFuturos.length) {
            console.log(`[DisponibilidadeService] ⏰ Horários filtrados (passados): ${slots.length - slotsFuturos.length} horários removidos`);
        }
        if (slotsFuturos.length > 0) {
            console.log(`[DisponibilidadeService] Primeiros 5 slots (futuros):`, slotsFuturos.slice(0, 5));
            if (slotsFuturos.length > 5) {
                console.log(`[DisponibilidadeService] Últimos 3 slots (futuros):`, slotsFuturos.slice(-3));
            }
        } else if (usandoHorarioPadrao) {
            console.warn(`[DisponibilidadeService] ⚠️ Nenhum slot disponível mesmo usando horário padrão. Todos os horários estão ocupados por agendamentos ou já passaram.`);
        } else if (slots.length > 0 && slotsFuturos.length === 0) {
            console.warn(`[DisponibilidadeService] ⚠️ Todos os ${slots.length} horários disponíveis já passaram (data verificada: hoje)`);
        }

        return slotsFuturos;
    }
    
    private async getIndisponibilidadeBloqueios(
        doutorId: number,
        inicioDia: Date,
        fimDia: Date,
        dayStart: BrazilMoment
    ): Promise<Array<{ start: number; end: number }>> {
        const indisponibilidades = await prisma.indisponibilidade.findMany({
            where: {
                doutorId,
                ativo: true,
                inicio: { lte: fimDia },
                fim: { gte: inicioDia },
            },
            select: {
                inicio: true,
                fim: true,
            },
        });

        const dayEnd = dayStart.clone().endOf('day');

        return indisponibilidades.reduce<Array<{ start: number; end: number }>>((acc, indisponibilidade) => {
            const inicio = moment(indisponibilidade.inicio).tz(BRAZIL_TZ);
            const fim = moment(indisponibilidade.fim).tz(BRAZIL_TZ);

            const intervaloInicio = moment.max(inicio, dayStart);
            const intervaloFim = moment.min(fim, dayEnd);

            if (!intervaloFim.isAfter(intervaloInicio)) {
                return acc;
            }

            const startMinutes = Math.max(0, intervaloInicio.diff(dayStart, 'minutes'));
            const fimHourInclusive = intervaloFim.hour();
            const endExclusive = Math.min((fimHourInclusive + 1) * 60, MINUTES_IN_DAY);

            acc.push({
                start: startMinutes,
                end: endExclusive,
            });

            return acc;
        }, []);
    }

    private isSlotBlocked(slotStartMin: number, bloqueios: Array<{ start: number; end: number }>): boolean {
        return bloqueios.some(({ start, end }) => slotStartMin >= start && slotStartMin < end);
    }
}

export default new DisponibilidadeService();

