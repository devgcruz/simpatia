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

    async getDisponibilidade(
        user: { id: number; role: string; clinicaId: number },
        doutorId: number,
        servicoId: number,
        data: string
    ): Promise<string[]> {
        const servico = await prisma.servico.findFirst({
            where: { id: servicoId, clinicaId: user.clinicaId },
        });

        const doutor = await prisma.doutor.findFirst({
            where: { id: doutorId, clinicaId: user.clinicaId },
        });

        if (!servico || !doutor) {
            throw new Error("Serviço ou Doutor não encontrado ou não pertence à esta clínica.");
        }

        // Converter string de data para Date
        const dataObj = new Date(data);
        const diaSemana = dataObj.getDay(); // 0 = Domingo, 1 = Segunda, etc.

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
            where: { id: servicoId, clinicaId },
        });
        console.log(`[DisponibilidadeService] 🔍 Serviço encontrado: ${servico ? `SIM (id=${servico.id}, nome="${servico.nome}", clinicaId=${servico.clinicaId})` : 'NÃO'}`);

        console.log(`[DisponibilidadeService] 🔍 Buscando doutor: id=${doutorId}, clinicaId=${clinicaId}`);
        const doutor = await prisma.doutor.findFirst({
            where: { id: doutorId, clinicaId },
        });
        
        // Se não encontrou com filtro de clinicaId, verificar se existe sem filtro
        if (!doutor) {
            console.warn(`[DisponibilidadeService] ⚠️ Doutor ${doutorId} não encontrado com filtro clinicaId=${clinicaId}`);
            const doutorSemFiltro = await prisma.doutor.findUnique({
                where: { id: doutorId },
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

        // Parse manual da data para evitar problemas de fuso horário
        // A data vem no formato AAAA-MM-DD
        const partes = data.split('-');
        if (partes.length !== 3) {
          console.error(`[DisponibilidadeService] Data inválida: ${data}`);
          throw new Error('Data inválida. Use o formato AAAA-MM-DD.');
        }
        const ano = Number(partes[0]);
        const mes = Number(partes[1]) - 1; // getMonth() retorna 0-11
        const dia = Number(partes[2]);
        
        // Cria data em hora local (meio-dia para evitar problemas de fuso)
        const dataObj = new Date(ano, mes, dia, 12, 0, 0);
        const diaSemana = dataObj.getDay();
        
        console.log(`[DisponibilidadeService] Data processada: entrada="${data}", parseada como ${ano}/${mes + 1}/${dia}, dia da semana: ${diaSemana} (0=Domingo, 1=Segunda, ..., 5=Sexta, 6=Sábado)`);

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

        const inicioDia = new Date(dataObj);
        inicioDia.setHours(0, 0, 0, 0);

        const fimDia = new Date(dataObj);
        fimDia.setHours(23, 59, 59, 999);

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
            },
            include: {
                servico: true,
            },
        });

        console.log(`[DisponibilidadeService] Agendamentos encontrados para o dia: ${agendamentos.length}`);
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

        // FILTRAR HORÁRIOS QUE JÁ PASSARAM (especialmente se a data é hoje)
        const agora = new Date();
        const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        const dataVerificacao = new Date(ano, mes, dia);
        
        // Se estamos verificando para hoje, remover horários que já passaram
        const slotsFuturos = slots.filter((slot) => {
            const [horaStr, minutoStr] = slot.split(':');
            const horaSlot = parseInt(horaStr || '0', 10);
            const minutoSlot = parseInt(minutoStr || '0', 10);
            
            // Se a data verificada é hoje
            if (dataVerificacao.getTime() === hoje.getTime()) {
                const horaAtual = agora.getHours();
                const minutoAtual = agora.getMinutes();
                const minutosAtuais = horaAtual * 60 + minutoAtual;
                const minutosSlot = horaSlot * 60 + minutoSlot;
                
                // Adiciona um buffer de 30 minutos para dar tempo de agendar
                const bufferMinutos = 30;
                const minutosLimite = minutosAtuais + bufferMinutos;
                
                if (minutosSlot < minutosLimite) {
                    console.log(`[DisponibilidadeService] ⏰ Filtrando horário no passado: ${slot} (hora atual: ${agora.toLocaleTimeString('pt-BR')})`);
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
}

export default new DisponibilidadeService();

