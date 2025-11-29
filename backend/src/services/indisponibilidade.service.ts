import { prisma } from '../lib/prisma';
import moment from 'moment-timezone';
import { formatBrazilDate, parseBrazilDateTime, BRAZIL_TZ } from '../utils/timezone';
import disponibilidadeService from './disponibilidade.service';

interface CreateIndisponibilidadeInput {
  doutorId: number;
  inicio: Date | string;
  fim: Date | string;
  motivo?: string;
}

interface AgendamentoConflitante {
  id: number;
  dataHora: Date;
  pacienteId: number;
  pacienteNome: string;
  servicoId: number;
  servicoNome: string;
  servicoDuracaoMin: number;
  status: string;
}

interface SugestaoReagendamento {
  data: string; // YYYY-MM-DD
  horariosDisponiveis: string[]; // Array de horários no formato HH:mm
}

interface ResultadoValidacao {
  temConflito: boolean;
  agendamentosConflitantes: AgendamentoConflitante[];
  sugestoesReagendamento: Map<number, SugestaoReagendamento[]>; // Mapa: agendamentoId -> sugestões
}

const formatResponse = <T extends { inicio: Date; fim: Date }>(item: T) => ({
  ...item,
  inicioFormatado: formatBrazilDate(item.inicio),
  fimFormatado: formatBrazilDate(item.fim),
});

class IndisponibilidadeService {
  /**
   * Verifica se há agendamentos conflitantes no intervalo de indisponibilidade
   */
  private async verificarConflitosAgendamentos(
    doutorId: number,
    inicio: Date,
    fim: Date,
    excluirIndisponibilidadeId?: number
  ): Promise<AgendamentoConflitante[]> {
    // Buscar agendamentos ativos que podem se sobrepõem com o intervalo de indisponibilidade
    // Um agendamento se sobrepõe se:
    // - Começa antes do fim da indisponibilidade E termina depois do início da indisponibilidade
    const indisponibilidadeInicio = moment(inicio).tz(BRAZIL_TZ);
    const indisponibilidadeFim = moment(fim).tz(BRAZIL_TZ);
    
    // Buscar todos os agendamentos que podem conflitar:
    // Um agendamento conflita se começa antes do fim da indisponibilidade E termina depois do início
    // Para isso, precisamos buscar agendamentos que:
    // - Começam antes do fim da indisponibilidade (mesmo que comecem dias antes)
    // - Podem começar depois, mas ainda se sobrepor se forem muito longos
    
    // Estimar duração máxima de um agendamento (8 horas) para calcular janela de busca
    const inicioBusca = moment(inicio).tz(BRAZIL_TZ).subtract(8, 'hours').toDate();
    const fimBusca = moment(fim).tz(BRAZIL_TZ).add(8, 'hours').toDate();
    
    const agendamentos = await prisma.agendamento.findMany({
      where: {
        doutorId,
        ativo: true,
        status: {
          not: 'cancelado', // Apenas agendamentos não cancelados
        },
        dataHora: {
          gte: inicioBusca,
          lte: fimBusca,
        },
      },
      include: {
        paciente: {
          select: {
            id: true,
            nome: true,
          },
        },
        servico: {
          select: {
            id: true,
            nome: true,
            duracaoMin: true,
          },
        },
      },
    });

    const conflitantes: AgendamentoConflitante[] = [];

    for (const agendamento of agendamentos) {
      const agendamentoInicio = moment(agendamento.dataHora).tz(BRAZIL_TZ);
      const agendamentoFim = agendamentoInicio.clone().add(agendamento.servico.duracaoMin, 'minutes');

      // Verificar se os intervalos se sobrepõem
      // Dois intervalos se sobrepõem se: inicio1 < fim2 && inicio2 < fim1
      if (
        agendamentoInicio.isBefore(indisponibilidadeFim) &&
        indisponibilidadeInicio.isBefore(agendamentoFim)
      ) {
        conflitantes.push({
          id: agendamento.id,
          dataHora: agendamento.dataHora,
          pacienteId: agendamento.paciente.id,
          pacienteNome: agendamento.paciente.nome,
          servicoId: agendamento.servico.id,
          servicoNome: agendamento.servico.nome,
          servicoDuracaoMin: agendamento.servico.duracaoMin,
          status: agendamento.status,
        });
      }
    }

    return conflitantes;
  }

  /**
   * Gera sugestões de reagendamento para um agendamento conflitante
   */
  private async sugerirReagendamento(
    agendamento: AgendamentoConflitante,
    doutorId: number,
    clinicaId: number,
    diasParaFrente: number = 30
  ): Promise<SugestaoReagendamento[]> {
    const sugestoes: SugestaoReagendamento[] = [];
    const dataAtual = moment().tz(BRAZIL_TZ);
    const dataAgendamento = moment(agendamento.dataHora).tz(BRAZIL_TZ);

    // Buscar disponibilidade nos próximos dias (até 30 dias à frente)
    for (let i = 1; i <= diasParaFrente; i++) {
      const dataCandidata = dataAtual.clone().add(i, 'days');
      
      // Pular o próprio dia do agendamento original
      if (dataCandidata.isSame(dataAgendamento, 'day')) {
        continue;
      }

      try {
        // Usar o serviço de disponibilidade para buscar horários disponíveis
        const dataStr = dataCandidata.format('YYYY-MM-DD');
        const horariosDisponiveis = await disponibilidadeService.getDisponibilidade(
          { id: 0, role: 'CLINICA_ADMIN', clinicaId },
          doutorId,
          agendamento.servicoId,
          dataStr
        );

        if (horariosDisponiveis.length > 0) {
          // Limitar a 5 horários por dia para não sobrecarregar
          sugestoes.push({
            data: dataStr,
            horariosDisponiveis: horariosDisponiveis.slice(0, 5),
          });
        }

        // Limitar a 5 dias com disponibilidade para não sobrecarregar
        if (sugestoes.length >= 5) {
          break;
        }
      } catch (error) {
        // Se houver erro ao buscar disponibilidade para um dia, continuar
        console.warn(`Erro ao buscar disponibilidade para ${dataCandidata.format('YYYY-MM-DD')}:`, error);
      }
    }

    return sugestoes;
  }

  /**
   * Valida conflitos e gera sugestões de reagendamento
   */
  async validarConflitosComAgendamentos(
    doutorId: number,
    clinicaId: number,
    inicio: Date | string,
    fim: Date | string,
    excluirIndisponibilidadeId?: number
  ): Promise<ResultadoValidacao> {
    const inicioDate = typeof inicio === 'string' ? parseBrazilDateTime(inicio).toDate() : inicio;
    const fimDate = typeof fim === 'string' ? parseBrazilDateTime(fim).toDate() : fim;

    // Verificar agendamentos conflitantes
    const agendamentosConflitantes = await this.verificarConflitosAgendamentos(
      doutorId,
      inicioDate,
      fimDate,
      excluirIndisponibilidadeId
    );

    const sugestoesReagendamento = new Map<number, SugestaoReagendamento[]>();

    // Para cada agendamento conflitante, gerar sugestões de reagendamento
    for (const agendamento of agendamentosConflitantes) {
      const sugestoes = await this.sugerirReagendamento(agendamento, doutorId, clinicaId);
      if (sugestoes.length > 0) {
        sugestoesReagendamento.set(agendamento.id, sugestoes);
      }
    }

    return {
      temConflito: agendamentosConflitantes.length > 0,
      agendamentosConflitantes,
      sugestoesReagendamento,
    };
  }

  async listByClinica(clinicaId: number) {
    const registros = await prisma.indisponibilidade.findMany({
      where: { doutor: { clinicaId } },
      include: { doutor: { select: { id: true, nome: true, clinicaId: true } } },
      orderBy: { inicio: 'asc' },
    });
    return registros.map(formatResponse);
  }

  async listByDoutor(doutorId: number) {
    const registros = await prisma.indisponibilidade.findMany({
      where: { doutorId, ativo: true },
      orderBy: { inicio: 'asc' },
    });
    return registros.map(formatResponse);
  }

  async create(
    data: CreateIndisponibilidadeInput,
    user: { clinicaId: number },
    options?: { ignorarConflitos?: boolean }
  ) {
    const { doutorId, inicio, fim, motivo } = data;

    // Verificar se doutor pertence à clínica do usuário
    const doutor = await prisma.doutor.findFirst({
      where: { id: doutorId, clinicaId: user.clinicaId, ativo: true },
      select: { id: true },
    });
    if (!doutor) {
      throw new Error('Doutor não encontrado ou não pertence a esta clínica.');
    }

    const inicioMoment = parseBrazilDateTime(inicio);
    const fimMoment = parseBrazilDateTime(fim);

    if (!fimMoment.isAfter(inicioMoment)) {
      throw new Error('Período inválido.');
    }

    const inicioDate = inicioMoment.tz(BRAZIL_TZ).toDate();
    const fimDate = fimMoment.tz(BRAZIL_TZ).toDate();

    // Validar conflitos com agendamentos
    const validacao = await this.validarConflitosComAgendamentos(
      doutorId,
      user.clinicaId,
      inicioDate,
      fimDate
    );

    // Se houver conflitos e não foi solicitado ignorar, retornar erro com sugestões
    if (validacao.temConflito && !options?.ignorarConflitos) {
      // Converter Map para objeto para serialização JSON
      const sugestoesObj: Record<string, SugestaoReagendamento[]> = {};
      validacao.sugestoesReagendamento.forEach((sugestoes, agendamentoId) => {
        sugestoesObj[agendamentoId.toString()] = sugestoes;
      });

      const erro: any = new Error(
        `Existem ${validacao.agendamentosConflitantes.length} agendamento(s) conflitante(s) no período especificado.`
      );
      erro.code = 'CONFLITO_AGENDAMENTOS';
      erro.agendamentosConflitantes = validacao.agendamentosConflitantes;
      erro.sugestoesReagendamento = sugestoesObj;
      throw erro;
    }

    const created = await prisma.indisponibilidade.create({
      data: {
        doutorId,
        inicio: inicioDate,
        fim: fimDate,
        motivo: motivo?.trim() || null,
      },
    });

    const resultado = formatResponse(created);
    
    // Se houver conflitos mas foi permitido criar, incluir aviso
    if (validacao.temConflito && options?.ignorarConflitos) {
      (resultado as any).avisoConflitos = {
        quantidade: validacao.agendamentosConflitantes.length,
        mensagem: 'Indisponibilidade criada com conflitos existentes.',
      };
    }

    return resultado;
  }

  async update(
    id: number,
    data: Partial<CreateIndisponibilidadeInput>,
    user: { clinicaId: number },
    options?: { ignorarConflitos?: boolean }
  ) {
    const registro = await prisma.indisponibilidade.findFirst({
      where: { id, doutor: { clinicaId: user.clinicaId } },
      select: { id: true, doutorId: true, inicio: true, fim: true },
    });
    if (!registro) {
      throw new Error('Indisponibilidade não encontrada.');
    }

    const updateData: any = {};
    let novoInicio: Date | undefined;
    let novoFim: Date | undefined;
    let novoDoutorId: number | undefined;

    if (data.inicio) {
      novoInicio = parseBrazilDateTime(data.inicio).tz(BRAZIL_TZ).toDate();
      updateData.inicio = novoInicio;
    }
    if (data.fim) {
      novoFim = parseBrazilDateTime(data.fim).tz(BRAZIL_TZ).toDate();
      updateData.fim = novoFim;
    }
    if (data.motivo !== undefined) {
      updateData.motivo = data.motivo?.trim() ?? null;
    }
    if (data.doutorId) {
      // Verificar se novo doutor pertence à clínica
      const doutor = await prisma.doutor.findFirst({
        where: { id: data.doutorId, clinicaId: user.clinicaId, ativo: true },
        select: { id: true },
      });
      if (!doutor) {
        throw new Error('Doutor não encontrado ou não pertence a esta clínica.');
      }
      novoDoutorId = data.doutorId;
      updateData.doutorId = novoDoutorId;
    }

    // Determinar qual intervalo usar para validação
    const inicioValidacao = novoInicio || registro.inicio;
    const fimValidacao = novoFim || registro.fim;
    const doutorIdValidacao = novoDoutorId || registro.doutorId;

    // Validar período se ambos estão sendo atualizados ou se início/fim foram atualizados
    if (updateData.inicio && updateData.fim) {
      const inicioMoment = moment(inicioValidacao).tz(BRAZIL_TZ);
      const fimMoment = moment(fimValidacao).tz(BRAZIL_TZ);
      if (!fimMoment.isAfter(inicioMoment)) {
        throw new Error('Período inválido.');
      }
    }

    // Validar conflitos se início ou fim foram alterados
    if (novoInicio || novoFim || novoDoutorId) {
      const validacao = await this.validarConflitosComAgendamentos(
        doutorIdValidacao,
        user.clinicaId,
        inicioValidacao,
        fimValidacao,
        id // Excluir esta indisponibilidade da busca (para não considerar o período antigo)
      );

      // Se houver conflitos e não foi solicitado ignorar, retornar erro com sugestões
      if (validacao.temConflito && !options?.ignorarConflitos) {
        // Converter Map para objeto para serialização JSON
        const sugestoesObj: Record<string, SugestaoReagendamento[]> = {};
        validacao.sugestoesReagendamento.forEach((sugestoes, agendamentoId) => {
          sugestoesObj[agendamentoId.toString()] = sugestoes;
        });

        const erro: any = new Error(
          `Existem ${validacao.agendamentosConflitantes.length} agendamento(s) conflitante(s) no período especificado.`
        );
        erro.code = 'CONFLITO_AGENDAMENTOS';
        erro.agendamentosConflitantes = validacao.agendamentosConflitantes;
        erro.sugestoesReagendamento = sugestoesObj;
        throw erro;
      }
    }

    const updated = await prisma.indisponibilidade.update({
      where: { id },
      data: updateData,
    });

    const resultado = formatResponse(updated);

    // Se houver conflitos mas foi permitido atualizar, incluir aviso
    if ((novoInicio || novoFim || novoDoutorId) && options?.ignorarConflitos) {
      const validacao = await this.validarConflitosComAgendamentos(
        doutorIdValidacao,
        user.clinicaId,
        inicioValidacao,
        fimValidacao,
        id
      );
      if (validacao.temConflito) {
        (resultado as any).avisoConflitos = {
          quantidade: validacao.agendamentosConflitantes.length,
          mensagem: 'Indisponibilidade atualizada com conflitos existentes.',
        };
      }
    }

    return resultado;
  }

  async delete(id: number, user: { clinicaId: number }) {
    const registro = await prisma.indisponibilidade.findFirst({
      where: { id, doutor: { clinicaId: user.clinicaId } },
      select: { id: true },
    });
    if (!registro) {
      throw new Error('Indisponibilidade não encontrada.');
    }
    const updated = await prisma.indisponibilidade.update({ 
      where: { id },
      data: { ativo: false },
    });
    return formatResponse(updated);
  }
}

export default new IndisponibilidadeService();
