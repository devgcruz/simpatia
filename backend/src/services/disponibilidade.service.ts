import { prisma } from '../lib/prisma';

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

    async getDisponibilidade(doutorId: number, servicoId: number, data: string): Promise<string[]> {
        // Converter string de data para Date
        const dataObj = new Date(data);
        const diaSemana = dataObj.getDay(); // 0 = Domingo, 1 = Segunda, etc.

        // Buscar duração do serviço
        const servico = await prisma.servico.findUnique({
            where: { id: servicoId },
        });

        if (!servico) {
            throw new Error("Serviço não encontrado.");
        }

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
        const inicioDia = new Date(dataObj);
        inicioDia.setHours(0, 0, 0, 0);
        
        const fimDia = new Date(dataObj);
        fimDia.setHours(23, 59, 59, 999);

        const agendamentos = await prisma.agendamento.findMany({
            where: {
                doutorId: doutorId,
                dataHora: {
                    gte: inicioDia,
                    lte: fimDia,
                },
                // Considerar apenas agendamentos confirmados ou pendentes (não cancelados)
                status: {
                    not: 'cancelado'
                }
            },
            include: {
                servico: true,
            },
        });

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

            if (disponivel) {
                slots.push(slotTime);
            }

            // Avançar para o próximo slot (usar duração do serviço como intervalo)
            currentMin += duracaoMin;
        }

        return slots;
    }
}

export default new DisponibilidadeService();

