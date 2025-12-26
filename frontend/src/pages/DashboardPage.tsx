import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment-timezone';
import 'moment/locale/pt-br';
import { Box, CircularProgress, useMediaQuery, useTheme, IconButton, Tooltip, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { toast } from 'sonner';

import {
  getAgendamentos,
  createAgendamento,
  updateAgendamento,
  deleteAgendamento,
  AgendamentoCreateInput,
  AgendamentoUpdateInput,
} from '../services/agendamento.service';
import { IAgendamento, IClinica, IDoutor } from '../types/models';

import { AgendamentoFormModal } from '../components/agendamentos/AgendamentoFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { SafeCalendar } from '../components/common/SafeCalendar';
import { useAuth } from '../hooks/useAuth';
import { useDoutorSelecionado } from '../context/DoutorSelecionadoContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { getMinhaClinica } from '../services/clinica.service';
import { Indisponibilidade } from '../services/indisponibilidade.service';
import { IndisponibilidadeManagerModal } from '../components/doutores/IndisponibilidadeManagerModal';
import { getDoutores } from '../services/doutor.service';
import { SelectDoutorModal } from '../components/common/SelectDoutorModal';
import { listarIndisponibilidadesDoDoutor } from '../services/indisponibilidade.service';
import { AlterarPausaModal } from '../components/common/AlterarPausaModal';
import { listarExcecoesDoDoutor, PausaExcecao } from '../services/pausa-excecao.service';
import { getServicos } from '../services/servico.service';
import { getHorariosByDoutor } from '../services/horario.service';

const BRAZIL_TZ = 'America/Sao_Paulo';
moment.tz.setDefault(BRAZIL_TZ);

moment.updateLocale('pt-br', {
  week: { dow: 0, doy: 4 }, // dow: 0 = Domingo (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
  weekdaysShort: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  weekdaysMin: ['do', 'sg', 'te', 'qa', 'qi', 'sx', 'sa'],
  monthsShort: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  months: [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ],
});
moment.locale('pt-br');
const localizer = momentLocalizer(moment);

const formats = {
  weekdayFormat: (date: Date) => moment(date).locale('pt-br').format('ddd'),
  dayFormat: (date: Date) => moment(date).locale('pt-br').format('DD ddd'),
  dayHeaderFormat: (date: Date) => moment(date).locale('pt-br').format('DD ddd'),
  rangeHeaderFormat: ({ start, end }: { start: Date; end: Date }, culture?: string, localizer?: any) => {
    const startLabel = localizer
      ? localizer.format(start, 'DD MMM', culture)
      : moment(start).locale('pt-br').format('DD MMM');
    const endLabel = localizer
      ? localizer.format(end, 'DD MMM', culture)
      : moment(end).locale('pt-br').format('DD MMM');
    return `${startLabel} – ${endLabel}`;
  },
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).locale('pt-br').format('DD MMM')} – ${moment(end).locale('pt-br').format('DD MMM')}`,
  monthHeaderFormat: (date: Date) => moment(date).locale('pt-br').format('MMMM YYYY'),
  agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).locale('pt-br').format('DD MMM YYYY')} – ${moment(end).locale('pt-br').format('DD MMM YYYY')}`,
  // Formato de horário 24 horas (HH:mm)
  timeGutterFormat: (date: Date) => moment(date).format('HH:mm'),
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format('HH:mm')} – ${moment(end).format('HH:mm')}`,
  eventTimeRangeStartFormat: ({ start }: { start: Date }) => moment(start).format('HH:mm'),
  eventTimeRangeEndFormat: ({ end }: { end: Date }) => moment(end).format('HH:mm'),
  agendaTimeFormat: (date: Date) => moment(date).format('HH:mm'),
  agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format('HH:mm')} – ${moment(end).format('HH:mm')}`,
};

const messages = {
  allDay: 'Dia todo',
  previous: '<',
  next: '>',
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'Não há eventos neste período.',
};

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: IAgendamento;
}

export const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { doutorSelecionado: doutorSelecionadoContext, isLoading: isLoadingDoutorContext } = useDoutorSelecionado();

  const [eventos, setEventos] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinica, setClinica] = useState<IClinica | null>(null);
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [doutorAgendaSelecionado, setDoutorAgendaSelecionado] = useState<IDoutor | null>(null);
  const [isSelectDoutorModalOpen, setIsSelectDoutorModalOpen] = useState(false);
  const [loadingDoutores, setLoadingDoutores] = useState(true);

  // Para SECRETARIA, usar o doutor do contexto; para outros roles, usar o estado local
  const doutorAtual = user?.role === 'SECRETARIA' ? doutorSelecionadoContext : doutorAgendaSelecionado;

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isIndisponibilidadeModalOpen, setIsIndisponibilidadeModalOpen] = useState(false);
  const [selectedDoutor, setSelectedDoutor] = useState<IDoutor | null>(null);
  const [indisponibilidadeEditando, setIndisponibilidadeEditando] = useState<Indisponibilidade | null>(null);
  const [isAlterarPausaModalOpen, setIsAlterarPausaModalOpen] = useState(false);
  const [pausaSelecionada, setPausaSelecionada] = useState<{ data: Date; doutorId?: number; horarioInicio?: string; horarioFim?: string } | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<IAgendamento | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ dataHora: Date } | null>(null);

  const formatarEventos = (agendamentos: IAgendamento[]): CalendarEvent[] =>
    agendamentos
      .filter((ag) => ag && ag.paciente && ag.servico) // Filtrar agendamentos inválidos
      .map((ag) => ({
        id: ag.id,
        title: `${ag.paciente?.nome || 'Paciente'} (${ag.servico?.nome || 'Serviço'})`,
        start: new Date(ag.dataHora),
        end: moment(ag.dataHora).add(ag.servico?.duracaoMin || 30, 'minutes').toDate(),
        resource: ag,
      }));

  const criarEventosPausa = async (doutorId?: number, horariosDoutorData?: Record<number, { inicio: string; fim: string; pausaInicio?: string | null; pausaFim?: string | null }>): Promise<CalendarEvent[]> => {
    const eventosPausa: CalendarEvent[] = [];
    const hoje = moment().startOf('day');
    // Data inicial: 1 ano atrás para mostrar eventos retroativos
    const dataInicial = hoje.clone().subtract(365, 'days');
    // Data final: 1 ano no futuro
    const dataFinal = hoje.clone().add(365, 'days');
    // Calcular total de dias entre data inicial e final
    const totalDias = dataFinal.diff(dataInicial, 'days');
    let indexCounter = 0;

    // Buscar exceções de pausa do doutor se houver doutor selecionado
    let excecoesDoutor: PausaExcecao[] = [];
    if (doutorId) {
      try {
        const dataInicioStr = dataInicial.format('YYYY-MM-DD');
        const dataFimStr = dataFinal.format('YYYY-MM-DD');
        excecoesDoutor = await listarExcecoesDoDoutor(doutorId, dataInicioStr, dataFimStr);
      } catch (err) {
        console.error('Erro ao buscar exceções de pausa do doutor:', err);
      }
    }
    
    // A agenda agora é baseada no horário do doutor, não da clínica
    // Se não houver doutor selecionado, não mostrar eventos de pausa
    if (!doutorId) {
      return eventosPausa;
    }
    
    // Eventos de pausa do doutor selecionado
    try {
      // Para SECRETARIA, usar doutorAtual diretamente (vem do contexto com todos os campos)
      // Para outros roles, tentar buscar na lista doutores ou usar doutorAtual
      let doutor: IDoutor | undefined;
      
      if (user?.role === 'SECRETARIA' && doutorAtual && doutorAtual.id === doutorId) {
        // Para SECRETARIA, usar o doutor do contexto que já tem todos os campos
        doutor = doutorAtual;
      } else if (doutorAtual && doutorAtual.id === doutorId) {
        // Se doutorAtual tem o ID correto, usar ele
        doutor = doutorAtual;
      } else {
        // Tentar buscar na lista doutores
        doutor = doutores.find((d) => d.id === doutorId);
      }
      
      if (!doutor) {
        return eventosPausa;
      }

      // Eventos de dias bloqueados do doutor (dia inteiro) - verificar primeiro
      const diasBloqueadosDoutor = doutor.diasBloqueados || [];

      // Buscar horários do doutor da tabela Horario se não foram passados
      let horariosDoDoutor: Record<number, { inicio: string; fim: string; pausaInicio?: string | null; pausaFim?: string | null }> | undefined = horariosDoutorData;
      
      // Se não temos horários ou se o objeto está vazio, buscar do backend
      if ((!horariosDoDoutor || Object.keys(horariosDoDoutor).length === 0) && doutorId) {
        try {
          const horariosArray = await getHorariosByDoutor(doutorId);
          horariosDoDoutor = {};
          horariosArray.forEach(h => {
            if (h.ativo) {
              horariosDoDoutor![h.diaSemana] = {
                inicio: h.inicio,
                fim: h.fim,
                pausaInicio: h.pausaInicio || null,
                pausaFim: h.pausaFim || null,
              };
            }
          });
        } catch (err) {
          console.error('Erro ao buscar horários do doutor para eventos de pausa:', err);
        }
      }

      // Eventos de horário de almoço do doutor (apenas em dias não bloqueados e que tenham horário configurado)
      if (horariosDoDoutor && Object.keys(horariosDoDoutor).length > 0) {
        
        for (let i = 0; i <= totalDias; i++) {
          const data = dataInicial.clone().add(i, 'days');
          const diaSemana = data.day(); // 0 = Domingo, 6 = Sábado
          const dataStr = data.format('YYYY-MM-DD');

          // Só criar evento de horário de almoço se o dia NÃO estiver bloqueado E tiver horário configurado
          if (!diasBloqueadosDoutor.includes(diaSemana) && horariosDoDoutor[diaSemana]) {
            const horario = horariosDoDoutor[diaSemana];
            
            // Verificar se há pausa configurada para este dia
            // Verificar se pausaInicio e pausaFim não são null, undefined ou string vazia
            const pausaInicioValida = horario.pausaInicio && typeof horario.pausaInicio === 'string' && horario.pausaInicio.trim() !== '';
            const pausaFimValida = horario.pausaFim && typeof horario.pausaFim === 'string' && horario.pausaFim.trim() !== '';
            const temPausa = pausaInicioValida && pausaFimValida;
            
            if (temPausa) {
              // Verificar se há exceção de pausa para esta data
              const excecoesParaData = excecoesDoutor
                .map((ex) => ({
                  ...ex,
                  excecaoDataStr: moment.utc(ex.data).format('YYYY-MM-DD'),
                }))
                .filter((ex) => ex.excecaoDataStr === dataStr)
                .sort((a, b) => {
                  const dateA = new Date(a.createdAt || 0).getTime();
                  const dateB = new Date(b.createdAt || 0).getTime();
                  return dateB - dateA;
                });
              
              const excecao = excecoesParaData[0]; // Pegar a primeira (mais recente)
              const pausaInicio = excecao ? excecao.pausaInicio : (horario.pausaInicio || '');
              const pausaFim = excecao ? excecao.pausaFim : (horario.pausaFim || '');
              
              // Garantir que temos valores válidos
              if (pausaInicio && pausaFim && pausaInicio.trim() !== '' && pausaFim.trim() !== '') {
                const [inicioHora, inicioMinuto] = pausaInicio.split(':').map(Number);
                const [fimHora, fimMinuto] = pausaFim.split(':').map(Number);
                
                const inicioPausa = data.clone().hour(inicioHora).minute(inicioMinuto).second(0).toDate();
                const fimPausa = data.clone().hour(fimHora).minute(fimMinuto).second(0).toDate();
                
                // Validar que as datas são válidas antes de criar o evento
                if (!inicioPausa || !fimPausa || isNaN(inicioPausa.getTime()) || isNaN(fimPausa.getTime())) {
                  console.warn('Pausa com datas inválidas:', { inicioPausa, fimPausa, pausaInicio, pausaFim });
                  continue;
                }
                
                const eventoPausa: CalendarEvent = {
                  id: -1000000 - indexCounter++,
                  title: `Pausa (${doutor.nome || 'Doutor'})`,
                  start: inicioPausa,
                  end: fimPausa,
                  resource: {
                    id: 0,
                    dataHora: inicioPausa.toISOString(),
                    status: 'pausa',
                    paciente: { id: 0, nome: 'Pausa', telefone: '', clinicaId: 0 },
                    doutor: { id: doutor.id, nome: doutor.nome, email: doutor.email, role: doutor.role, clinicaId: doutor.clinicaId || 0 },
                    servico: { id: 0, nome: 'Pausa', descricao: '', duracaoMin: 0, preco: 0, clinicaId: 0 },
                    pausaData: dataStr,
                    pausaInicio,
                    pausaFim,
                  } as any,
                };
                eventosPausa.push(eventoPausa);
              }
            }
          }
        }
      }

      // NÃO criar eventos de dias bloqueados - eles não devem aparecer na agenda de forma alguma
    } catch (err) {
      console.error('Erro ao buscar doutor para eventos de pausa:', err);
    }
    
    return eventosPausa;
  };

  const fetchAgendamentos = useCallback(async () => {
    if (!doutorAtual) {
      setEventos([]); // Limpar eventos quando não há doutor selecionado
      return;
    }

    try {
      setLoading(true);
      // Buscar agendamentos filtrados por doutor
      const data: IAgendamento[] = await getAgendamentos({ doutorId: doutorAtual.id });
      const eventosFormatados = formatarEventos(Array.isArray(data) ? data : []);
      
      // Buscar indisponibilidades do doutor selecionado
      const indisps = await listarIndisponibilidadesDoDoutor(doutorAtual.id);
      const eventosIndisp: CalendarEvent[] = indisps
        .filter((i) => i && i.inicio && i.fim) // Filtrar indisponibilidades inválidas
        .map((i) => {
          try {
            const inicio = moment(i.inicio).tz(BRAZIL_TZ);
            const fim = moment(i.fim).tz(BRAZIL_TZ);
            
            // Validar que as datas são válidas
            if (!inicio.isValid() || !fim.isValid()) {
              console.warn('Indisponibilidade com datas inválidas:', i);
              return null;
            }
            
            // Exibir exatamente o horário cadastrado no card
            // O backend já cuida de bloquear até o final da hora final (até 10:59 se cadastrado 10:00)

            return {
              id: -i.id,
              title: `Indisponível${i.motivo ? ` (${i.motivo})` : ''}`,
              start: inicio.toDate(),
              end: fim.toDate(),
              resource: {
                id: 0,
                dataHora: inicio.toISOString(),
                status: 'indisponivel',
                paciente: { id: 0, nome: 'Indisponibilidade', telefone: '', clinicaId: 0 },
                doutor: { id: doutorAtual.id, nome: doutorAtual.nome, email: '', role: 'DOUTOR', clinicaId: 0 },
                servico: { id: 0, nome: 'Indisponibilidade', descricao: '', duracaoMin: 0, preco: 0, clinicaId: 0 },
              } as any,
            };
          } catch (err) {
            console.warn('Erro ao processar indisponibilidade:', err, i);
            return null;
          }
        })
        .filter((e): e is CalendarEvent => e !== null); // Filtrar nulls
      
      // Adicionar eventos de pausa do doutor selecionado
      // Buscar horários completos do doutor para passar para criarEventosPausa
      let horariosCompletos: Record<number, { inicio: string; fim: string; pausaInicio?: string | null; pausaFim?: string | null }> | undefined;
      try {
        const horariosArray = await getHorariosByDoutor(doutorAtual.id);
        horariosCompletos = {};
          
          if (horariosArray.length === 0) {
            console.warn('⚠️ NENHUM horário encontrado no backend para o doutor ID:', doutorAtual.id);
            console.warn('Verifique se há horários cadastrados na aba "Expediente" do cadastro do doutor.');
          }
          
          horariosArray.forEach(h => {
            if (h.ativo) {
              horariosCompletos![h.diaSemana] = {
                inicio: h.inicio,
                fim: h.fim,
                pausaInicio: h.pausaInicio,
                pausaFim: h.pausaFim,
              };
            }
          });
      } catch (err) {
        console.error('Erro ao buscar horários completos do doutor:', err);
      }
      const eventosPausa = await criarEventosPausa(doutorAtual.id, horariosCompletos);
      
      // Filtrar eventos que estão em dias bloqueados - não devem aparecer na agenda
      const diasBloqueados = doutorAtual.diasBloqueados || [];
      
      // Combinar todos os eventos e validar rigorosamente
      const todosEventos = [...eventosFormatados, ...eventosIndisp, ...eventosPausa];
      
      const eventosFiltrados = todosEventos
        .filter((evento) => {
          // Validação rigorosa: evento deve existir e ser um objeto válido
          if (!evento || typeof evento !== 'object') {
            console.warn('Evento inválido encontrado:', evento);
            return false;
          }
          // Deve ter title como string não vazia
          if (!evento.title || typeof evento.title !== 'string' || evento.title.trim() === '') {
            console.warn('Evento sem title válido:', evento);
            return false;
          }
          // Deve ter start e end como Date válidos
          if (!evento.start || !(evento.start instanceof Date) || isNaN(evento.start.getTime())) {
            console.warn('Evento com start inválido:', evento);
            return false;
          }
          if (!evento.end || !(evento.end instanceof Date) || isNaN(evento.end.getTime())) {
            console.warn('Evento com end inválido:', evento);
            return false;
          }
          return true;
        })
        .filter(evento => {
          // Verificar se o evento está em um dia bloqueado
          try {
            const diaSemanaEvento = moment(evento.start).tz(BRAZIL_TZ).day();
            if (diasBloqueados.includes(diaSemanaEvento)) {
              return false;
            }
          } catch (err) {
            console.warn('Erro ao verificar dia da semana do evento:', err, evento);
            return false;
          }
          
          return true;
        });
      
      // Garantir que todos os eventos têm todas as propriedades necessárias
      const eventosValidados: CalendarEvent[] = [];
      
      for (const evento of eventosFiltrados) {
        try {
          // Validação final antes de adicionar
          if (!evento || typeof evento !== 'object' || Array.isArray(evento)) {
            console.warn('Evento inválido no mapeamento final:', evento);
            continue;
          }
          
          if (!evento.title || typeof evento.title !== 'string' || evento.title.trim() === '') {
            console.warn('Evento sem title válido no mapeamento final:', evento);
            continue;
          }
          
          if (!evento.start || !(evento.start instanceof Date) || isNaN(evento.start.getTime())) {
            console.warn('Evento com start inválido no mapeamento final:', evento);
            continue;
          }
          
          if (!evento.end || !(evento.end instanceof Date) || isNaN(evento.end.getTime())) {
            console.warn('Evento com end inválido no mapeamento final:', evento);
            continue;
          }
          
          eventosValidados.push({
            id: Number(evento.id) || 0,
            title: String(evento.title).trim(),
            start: new Date(evento.start.getTime()),
            end: new Date(evento.end.getTime()),
            resource: evento.resource || {},
          });
        } catch (err) {
          console.error('Erro ao mapear evento:', err, evento);
          continue;
        }
      }
      
      // Garantir que sempre seja um array válido e não-nulo
      const finalArray = Array.isArray(eventosValidados) 
        ? eventosValidados.filter((e) => e !== null && e !== undefined && typeof e === 'object')
        : [];
      
      console.log('DashboardPage: Eventos que serão salvos no estado:', finalArray.length, 'de', eventosFiltrados.length);
      
      setEventos(finalArray);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar agendamentos');
    } finally {
      setLoading(false);
    }
  }, [doutorAtual]);

  const fetchClinica = async () => {
    if (!user?.clinicaId) return;
    try {
      const clinicaEncontrada = await getMinhaClinica();
      if (clinicaEncontrada) {
        setClinica(clinicaEncontrada);
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados da clínica:', err);
      // Para DOUTOR, se a clínica não carregar, assumir valores padrão para não bloquear a interface
      if (user?.role === 'DOUTOR') {
        setClinica({
          id: user.clinicaId,
          nome: 'Clínica',
          possuiAgenda: true,
          possuiGerenciar: true,
        } as IClinica);
      } else {
        // Para outros roles, manter null para que a lógica de verificação funcione
        setClinica(null);
      }
    }
  };

  const fetchDoutores = useCallback(async () => {
    // Para SECRETARIA, não precisamos buscar doutores aqui (já está no contexto)
    if (user?.role === 'SECRETARIA') {
      setLoadingDoutores(false);
      return;
    }

    try {
      setLoadingDoutores(true);
      const data = await getDoutores();
      setDoutores(data);
      
      // Se o usuário for DOUTOR, selecionar automaticamente a agenda dele
      // DOUTOR não depende da clínica ser carregada
      if (user?.role === 'DOUTOR' && user.id) {
        // O backend já retorna apenas o doutor logado quando role é DOUTOR
        // Mas vamos garantir que seja o doutor correto
        const doutorLogado = data.find((d) => d.id === user.id) || (data.length === 1 ? data[0] : null);
        if (doutorLogado) {
          setDoutorAgendaSelecionado(doutorLogado);
        }
      } else {
        // Para outros roles (CLINICA_ADMIN, etc), verificar se a clínica possui módulo de agenda habilitado
        // Se a clínica ainda não foi carregada, assumir que possui agenda (comportamento padrão)
        const possuiAgenda = user?.role === 'SUPER_ADMIN' || clinica?.possuiAgenda !== false;
        
        if (!possuiAgenda && clinica !== null) {
          // Se a agenda estiver desabilitada E a clínica foi carregada, não mostrar modal
          setLoadingDoutores(false);
          return;
        }
        
        // Se houver apenas 1 doutor, selecionar automaticamente
        if (data.length === 1) {
          setDoutorAgendaSelecionado(data[0]);
        } else if (data.length > 1) {
          // Se houver mais de 1 doutor, mostrar modal de seleção
          setIsSelectDoutorModalOpen(true);
        }
      }
      // Se não houver doutores, doutorAgendaSelecionado permanece null
    } catch (err: any) {
      console.error('Erro ao buscar doutores:', err);
      toast.error(err.response?.data?.message || 'Erro ao buscar doutores');
    } finally {
      setLoadingDoutores(false);
    }
  }, [user?.role, user?.id, clinica?.possuiAgenda, clinica]);

  useEffect(() => {
    if (user?.clinicaId) {
      // Carregar clínica primeiro
      fetchClinica();
    }
  }, [user?.clinicaId]);

  // Carregar doutores após a clínica ser carregada (ou se for SUPER_ADMIN/DOUTOR)
  useEffect(() => {
    if (user?.clinicaId) {
      // Se for SUPER_ADMIN ou DOUTOR, sempre carregar doutores imediatamente (não depende da clínica)
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'DOUTOR') {
        fetchDoutores();
        return;
      }
      
      // Para outros roles (CLINICA_ADMIN, SECRETARIA), verificar se a clínica foi carregada e se possui agenda
      if (clinica !== null) {
        const possuiAgenda = clinica?.possuiAgenda !== false;
        if (possuiAgenda) {
          fetchDoutores();
        } else {
          // Se não possui agenda, garantir que loading seja false
          setLoadingDoutores(false);
        }
      }
      // Se a clínica ainda não foi carregada, aguardar que seja carregada
      // O useEffect será executado novamente quando clinica mudar
    }
  }, [user?.clinicaId, clinica, user?.role, fetchDoutores]);

  // Recarregar agendamentos quando o doutor selecionado mudar
  useEffect(() => {
    if (doutorAtual) {
      fetchAgendamentos();
    }
  }, [doutorAtual]);


  // WebSocket para atualização em tempo real
  const handleWebSocketUpdate = useCallback((event: any) => {
    // Verificar se o evento é relevante para o doutor atual
    // Se não houver doutorAtual ou se o evento for para o doutor atual, atualizar
    if (!doutorAtual || event.doutorId === doutorAtual.id) {
      // Atualizar agendamentos sem setTimeout para evitar "piscar"
      // Usar requestAnimationFrame para atualizar no próximo frame de renderização
      requestAnimationFrame(() => {
        fetchAgendamentos();
      });
    }
  }, [doutorAtual, fetchAgendamentos]);

  // WebSocket para atualização em tempo real - habilitar quando houver usuário
  const { subscribeToDoutor } = useWebSocket({
    doutorId: doutorAtual?.id || null,
    enabled: !!user, // Habilitar quando houver usuário
    onAgendamentoUpdate: handleWebSocketUpdate,
  });

  // Atualizar inscrição WebSocket quando o doutor mudar
  useEffect(() => {
    if (doutorAtual?.id) {
      subscribeToDoutor(doutorAtual.id);
    }
  }, [doutorAtual?.id, subscribeToDoutor]);

  // Escutar eventos de atualização de agendamento de outras páginas (fallback)
  useEffect(() => {
    const handleAgendamentoAtualizado = (event: Event) => {
      const customEvent = event as CustomEvent;
      const doutorIdEvento = customEvent.detail?.doutorId;
      // Se o evento for para o doutor atual ou não especificar doutor, atualizar instantaneamente
      if (!doutorIdEvento || doutorIdEvento === doutorAtual?.id) {
        // Usar setTimeout para garantir que a atualização aconteça após o evento ser processado
        setTimeout(() => {
          fetchAgendamentos();
        }, 100);
      }
    };

    window.addEventListener('agendamentoAtualizado', handleAgendamentoAtualizado);
    return () => {
      window.removeEventListener('agendamentoAtualizado', handleAgendamentoAtualizado);
    };
  }, [doutorAtual]);

  // Recarregar agendamentos quando a clínica mudar (para atualizar eventos de pausa)
  useEffect(() => {
    if (clinica && doutorAtual) {
      fetchAgendamentos();
    }
  }, [clinica?.pausaInicio, clinica?.pausaFim]);

  const handleOpenIndisponibilidadeModal = () => {
    setIsIndisponibilidadeModalOpen(true);
    // Se for DOUTOR, pré-selecionar ele mesmo
    if (user?.role === 'DOUTOR' && user.id) {
      // O modal vai carregar os doutores e podemos passar o ID inicial
      setSelectedDoutor({ id: user.id, nome: '', email: '', role: 'DOUTOR' } as IDoutor);
    } else {
      setSelectedDoutor(null);
    }
  };

  const handleCloseIndisponibilidadeModal = () => {
    setIsIndisponibilidadeModalOpen(false);
    setSelectedDoutor(null);
    setIndisponibilidadeEditando(null);
    // Recarregar indisponibilidades para atualizar o calendário
    fetchAgendamentos();
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    const resource = event.resource as any;
    
    // Verificar se é dia bloqueado (não permitir interação)
    const isDiaBloqueado = resource?.isDiaBloqueado || resource?.servico?.nome === 'Dia Bloqueado' || resource?.paciente?.nome === 'Dia Bloqueado' || event.title?.includes('Não há expediente');
    if (isDiaBloqueado) {
      return; // Não fazer nada em dias bloqueados
    }
    
    // Verificar se é uma indisponibilidade (id negativo ou status 'indisponivel')
    if (event.id < 0 || resource?.status === 'indisponivel') {
      // Se for evento de pausa (id muito negativo), abrir modal de alterar pausa
      if (event.id < -100000 && resource?.status === 'pausa') {
        
        // Abrir modal para alterar horário de pausa
        // Usar pausaData do resource se disponível, senão extrair data do event.start usando moment
        let dataPausa: Date;
        if (resource?.pausaData) {
          // Se temos pausaData no formato YYYY-MM-DD, criar data a partir dela
          const [ano, mes, dia] = resource.pausaData.split('-').map(Number);
          dataPausa = new Date(ano, mes - 1, dia);
        } else {
          // Extrair apenas a data (sem hora) do event.start usando moment para evitar problemas de fuso horário
          const dataMoment = moment(event.start);
          dataPausa = dataMoment.startOf('day').toDate();
        }
        
        const doutorId = resource?.doutor?.id || doutorAtual?.id;
        const horarioInicio = resource?.pausaInicio || (resource?.doutor?.id ? doutorAtual?.pausaInicio : clinica?.pausaInicio);
        const horarioFim = resource?.pausaFim || (resource?.doutor?.id ? doutorAtual?.pausaFim : clinica?.pausaFim);
        
        setPausaSelecionada({
          data: dataPausa,
          doutorId: resource?.doutor?.id ? doutorId : undefined,
          horarioInicio,
          horarioFim,
        });
        setIsAlterarPausaModalOpen(true);
        return;
      }
      
      // Se for evento de indisponibilidade (não pausa)
      if (event.id < -100000) {
        return;
      }
      
      // Buscar a indisponibilidade correspondente
      if (doutorAtual) {
        listarIndisponibilidadesDoDoutor(doutorAtual.id).then((indisps) => {
          const indisponibilidade = indisps.find((ind) => ind.id === Math.abs(event.id));
          if (indisponibilidade) {
            setIndisponibilidadeEditando(indisponibilidade);
            setSelectedDoutor({ id: doutorAtual.id, nome: doutorAtual.nome, email: '', role: 'DOUTOR' } as IDoutor);
            setIsIndisponibilidadeModalOpen(true);
          }
        });
      }
      return;
    }
    
    setSelectedEvent(event.resource);
    setSelectedSlot(null);
    setIsFormModalOpen(true);
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    // Verificar se o dia está bloqueado
    if (doutorAtual?.diasBloqueados) {
      const diaSemana = moment(slotInfo.start).tz(BRAZIL_TZ).day();
      if (doutorAtual.diasBloqueados.includes(diaSemana)) {
        toast.error('Este dia está bloqueado para este doutor.');
        return;
      }
    }

    setSelectedEvent(null);
    setSelectedSlot({ dataHora: slotInfo.start });
    setIsFormModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsFormModalOpen(false);
    setIsDeleteModalOpen(false);
    setSelectedEvent(null);
    setSelectedSlot(null);
  };

  const handleDeleteRequest = () => {
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };

  /**
   * Valida se um agendamento pode ser criado antes de confirmar
   * Verifica todas as regras de negócio
   */
  const validarAgendamento = async (data: AgendamentoCreateInput): Promise<{ valido: boolean; mensagem?: string }> => {
    const doutorId = data.doutorId || doutorAtual?.id;
    if (!doutorId) {
      return { valido: false, mensagem: 'Doutor não selecionado.' };
    }

    // 1. Verificar se horário existe e é válido
    const dataHora = moment(data.dataHora).tz(BRAZIL_TZ);
    if (!dataHora.isValid()) {
      return { valido: false, mensagem: 'Data/hora inválida.' };
    }

    // 6. Verificar se não está no passado (com buffer de 30 minutos)
    const agora = moment().tz(BRAZIL_TZ);
    const bufferMinutos = 30;
    if (dataHora.isBefore(agora.add(bufferMinutos, 'minutes'))) {
      return { valido: false, mensagem: 'Não é possível agendar no passado. Escolha um horário futuro.' };
    }

    // Buscar doutor completo para verificar horários de trabalho
    let doutor: IDoutor | undefined = doutorAtual || undefined;
    if (!doutor || doutor.id !== doutorId) {
      doutor = doutores.find(d => d.id === doutorId);
    }
    if (!doutor) {
      return { valido: false, mensagem: 'Doutor não encontrado.' };
    }

    // Buscar duração do serviço uma única vez para usar em múltiplas validações
    let duracaoServico = 30; // padrão conservador
    try {
      const servicos = await getServicos(doutorId);
      const servicoSelecionado = servicos.find(s => s.id === Number(data.servicoId));
      if (servicoSelecionado?.duracaoMin) {
        duracaoServico = servicoSelecionado.duracaoMin;
      }
    } catch (err) {
      console.warn('Não foi possível buscar duração do serviço:', err);
    }

    // 2. Verificar se horário pertence ao expediente do médico
    // Garantir que estamos usando o dia da semana correto no timezone do Brasil
    const diaSemana = dataHora.day(); // 0 = Domingo, 6 = Sábado
    
    // Verificar se o dia está bloqueado
    if (doutor.diasBloqueados?.includes(diaSemana)) {
      return { valido: false, mensagem: `Não há expediente neste dia da semana (${moment.weekdaysShort(diaSemana)}).` };
    }

    // Buscar horário de trabalho do doutor para este dia da semana
    let horarioTrabalho;
    try {
      const horarios = await getHorariosByDoutor(doutorId);
      
      // Buscar horário ativo para este dia da semana
      horarioTrabalho = horarios.find(h => h.diaSemana === diaSemana && h.ativo);
      
      // Log de debug apenas se não encontrar (para ajudar a diagnosticar o problema)
      if (!horarioTrabalho) {
        console.warn('⚠️ Horário não encontrado para agendamento:', {
          diaSemana,
          diaSemanaNome: moment.weekdays(diaSemana),
          dataHora: dataHora.format('YYYY-MM-DD HH:mm'),
          horariosEncontrados: horarios.length,
          horarios: horarios.map(h => ({ diaSemana: h.diaSemana, ativo: h.ativo, inicio: h.inicio, fim: h.fim }))
        });
      }
    } catch (err) {
      console.error('Erro ao buscar horários do doutor:', err);
      // Se não conseguir buscar, usar horários padrão do doutor (se existirem)
    }

    // Se não tem horário cadastrado para este dia, não permitir agendamento
    if (!horarioTrabalho) {
      return { valido: false, mensagem: `Não há horário de expediente cadastrado para ${moment.weekdays(diaSemana)}.` };
    }

    // Converter horários para minutos para facilitar comparação
    const horaInicioAgendamento = dataHora.hours() * 60 + dataHora.minutes();
    const horaFimAgendamento = horaInicioAgendamento + duracaoServico;
    const [inicioHora, inicioMin] = horarioTrabalho.inicio.split(':').map(Number);
    const [fimHora, fimMin] = horarioTrabalho.fim.split(':').map(Number);
    const inicioExpedienteMin = inicioHora * 60 + inicioMin;
    const fimExpedienteMin = fimHora * 60 + fimMin;

    // Verificar se o início está dentro do horário de expediente
    if (horaInicioAgendamento < inicioExpedienteMin) {
      return { 
        valido: false, 
        mensagem: `Este horário está antes do início do expediente (${horarioTrabalho.inicio}).` 
      };
    }

    // Verificar se o início do agendamento não ultrapassa o fim do expediente
    // Permitir agendamentos que comecem até o último horário possível (considerando a duração)
    if (horaInicioAgendamento >= fimExpedienteMin) {
      return { 
        valido: false, 
        mensagem: `Este horário está após o fim do expediente (${horarioTrabalho.fim}).` 
      };
    }
    
    // Verificar se o término do agendamento (considerando duração) está dentro do expediente
    // Permitir agendamentos que terminem exatamente no fim do expediente (>= em vez de >)
    if (horaFimAgendamento > fimExpedienteMin) {
      return { 
        valido: false, 
        mensagem: `Este horário com duração de ${duracaoServico} minutos ultrapassa o fim do expediente (${horarioTrabalho.fim}). O último horário disponível para este serviço é ${moment().startOf('day').add(fimExpedienteMin - duracaoServico, 'minutes').format('HH:mm')}.` 
      };
    }

    // Verificar se está na pausa de almoço (se existir)
    // Verificar se o agendamento se sobrepõe com a pausa
    if (horarioTrabalho.pausaInicio && horarioTrabalho.pausaFim) {
      const [pausaInicioHora, pausaInicioMinuto] = horarioTrabalho.pausaInicio.split(':').map(Number);
      const [pausaFimHora, pausaFimMinuto] = horarioTrabalho.pausaFim.split(':').map(Number);
      const pausaInicioMin = pausaInicioHora * 60 + pausaInicioMinuto;
      const pausaFimMin = pausaFimHora * 60 + pausaFimMinuto;
      
      // Verificar sobreposição: agendamento começa durante a pausa ou pausa começa durante o agendamento
      if ((horaInicioAgendamento >= pausaInicioMin && horaInicioAgendamento < pausaFimMin) ||
          (pausaInicioMin >= horaInicioAgendamento && pausaInicioMin < horaFimAgendamento)) {
        return { 
          valido: false, 
          mensagem: `Este horário conflita com o período de pausa (${horarioTrabalho.pausaInicio} - ${horarioTrabalho.pausaFim}).` 
        };
      }
    }

    // 4. Verificar se está fora de bloqueios (indisponibilidades)
    try {
      const indisponibilidades = await listarIndisponibilidadesDoDoutor(doutorId);
      for (const indisponibilidade of indisponibilidades) {
        const inicioIndisp = moment(indisponibilidade.inicio).tz(BRAZIL_TZ);
        const fimIndisp = moment(indisponibilidade.fim).tz(BRAZIL_TZ);
        
        // Verificar se o agendamento está dentro do período de indisponibilidade
        // Considera bloqueio até o final da hora final (até 10:59 se cadastrado 10:00)
        const fimIndispCompleto = fimIndisp.clone().endOf('hour');
        
        if (dataHora.isSameOrAfter(inicioIndisp, 'minute') && dataHora.isBefore(fimIndispCompleto, 'minute')) {
          const motivo = indisponibilidade.motivo ? ` (${indisponibilidade.motivo})` : '';
          return { 
            valido: false, 
            mensagem: `Este horário está bloqueado por indisponibilidade${motivo}.` 
          };
        }
      }
    } catch (err) {
      console.error('Erro ao verificar indisponibilidades:', err);
      // Continuar mesmo com erro, mas logar
    }

    // 3 e 5. Verificar se está livre e não conflita com outra consulta
    // Se for encaixe, não precisa verificar conflitos (permite agendar em horário ocupado)
    if (!data.isEncaixe) {
      // Buscar agendamentos do doutor no mesmo dia
      const inicioDia = dataHora.clone().startOf('day').toDate();
      const fimDia = dataHora.clone().endOf('day').toDate();
      
      try {
        const agendamentosDoDia = await getAgendamentos({ 
          doutorId,
          dataInicio: inicioDia.toISOString(),
          dataFim: fimDia.toISOString(),
        });
        
        // Buscar serviço para saber a duração
        // Como não temos acesso direto ao serviço aqui, vamos verificar conflitos com todos os agendamentos
        for (const agendamento of agendamentosDoDia) {
          // Pular se for o mesmo agendamento (caso de edição)
          if (selectedEvent && agendamento.id === selectedEvent.id) {
            continue;
          }
          
          // Pular cancelados
          if (agendamento.status === 'cancelado') {
            continue;
          }
          
          const agendamentoInicio = moment(agendamento.dataHora).tz(BRAZIL_TZ);
          // Usar duração real do serviço do agendamento existente
          const duracaoAgendamento = agendamento.servico?.duracaoMin || 30; // minutos, padrão 30 se não tiver
          const agendamentoFim = agendamentoInicio.clone().add(duracaoAgendamento, 'minutes');
          
          // Usar a duração do serviço já buscada anteriormente
          const novoAgendamentoFim = dataHora.clone().add(duracaoServico, 'minutes');
          
          // Verificar sobreposição: se o novo agendamento começa durante o existente
          if (dataHora.isSameOrAfter(agendamentoInicio, 'minute') && dataHora.isBefore(agendamentoFim, 'minute')) {
            return { 
              valido: false, 
              mensagem: `Este horário conflita com outro agendamento às ${agendamentoInicio.format('HH:mm')}. Marque como "Encaixe" se desejar agendar mesmo assim.` 
            };
          }
          
          // Verificar sobreposição: se o agendamento existente começa durante o novo
          if (agendamentoInicio.isSameOrAfter(dataHora, 'minute') && agendamentoInicio.isBefore(novoAgendamentoFim, 'minute')) {
            return { 
              valido: false, 
              mensagem: `Este horário conflita com outro agendamento às ${agendamentoInicio.format('HH:mm')}. Marque como "Encaixe" se desejar agendar mesmo assim.` 
            };
          }
        }
      } catch (err) {
        console.error('Erro ao verificar conflitos com outros agendamentos:', err);
        // Continuar mesmo com erro, mas logar
      }
    }

    return { valido: true };
  };

  const handleSubmitForm = async (data: AgendamentoCreateInput) => {
    // Validações antes de criar novo agendamento
    if (!selectedEvent) {
      const validacao = await validarAgendamento(data);
      if (!validacao.valido) {
        toast.error(validacao.mensagem || 'Não é possível criar este agendamento.');
        return;
      }
    }

    try {
      const doutorIdEvento = data.doutorId || doutorAtual?.id;
      
      if (selectedEvent) {
        const payload: AgendamentoUpdateInput = { ...data };
        await updateAgendamento(selectedEvent.id, payload);
        toast.success('Agendamento atualizado com sucesso!');
        // Disparar evento ANTES de atualizar para garantir atualização instantânea em todas as páginas
        window.dispatchEvent(new CustomEvent('agendamentoAtualizado', { 
          detail: { tipo: 'update', doutorId: payload.doutorId || doutorIdEvento } 
        }));
      } else {
        await createAgendamento(data);
        toast.success('Agendamento criado com sucesso!');
        // Disparar evento ANTES de atualizar para garantir atualização instantânea em todas as páginas
        window.dispatchEvent(new CustomEvent('agendamentoAtualizado', { 
          detail: { tipo: 'create', doutorId: doutorIdEvento } 
        }));
      }
      
      // Não recarregar aqui - o WebSocket vai atualizar automaticamente
      // Isso evita o "piscar" da agenda
      handleCloseModals();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar agendamento');
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    
    // Verificar se o agendamento está finalizado e é do dia atual
    const hoje = moment().startOf('day');
    const dataAgendamento = moment(selectedEvent.dataHora).startOf('day');
    const isMesmoDia = dataAgendamento.isSame(hoje, 'day');
    const isFinalizado = selectedEvent.status === 'finalizado';
    
    if (isFinalizado && isMesmoDia) {
      toast.error('Não é possível excluir um atendimento que foi finalizado hoje.');
      setIsDeleteModalOpen(false);
      return;
    }
    
    try {
      const doutorIdEvento = selectedEvent.doutor?.id || doutorAtual?.id;
      await deleteAgendamento(selectedEvent.id);
      toast.success('Agendamento excluído com sucesso!');
      // Disparar evento ANTES de atualizar para garantir atualização instantânea em todas as páginas
      window.dispatchEvent(new CustomEvent('agendamentoAtualizado', { 
        detail: { tipo: 'delete', doutorId: doutorIdEvento } 
      }));
      // Não recarregar aqui - o WebSocket vai atualizar automaticamente
      // Isso evita o "piscar" da agenda
      handleCloseModals();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao apagar agendamento');
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const { status } = event.resource;
    const resource = event.resource as any;
    let backgroundColor = '#2563eb';
    let color = 'white';
    let textDecoration: 'none' | 'line-through' = 'none';

    // Verificar se é dia bloqueado
    const isDiaBloqueado = resource?.isDiaBloqueado || resource?.servico?.nome === 'Dia Bloqueado' || resource?.paciente?.nome === 'Dia Bloqueado';

    // Eventos de pausa (cinza, não clicável)
    if (status === 'pausa' || (event as any).id < -100000) {
      backgroundColor = '#9ca3af'; // cinza
      color = '#ffffff';
      return {
        style: {
          backgroundColor,
          borderRadius: '5px',
          opacity: 0.6,
          color,
          border: '0px',
          textDecoration,
          cursor: isDiaBloqueado ? 'not-allowed' : 'default',
          pointerEvents: (isDiaBloqueado ? 'none' : 'auto') as React.CSSProperties['pointerEvents'], // Dias bloqueados não são clicáveis
        },
      };
    }

    if (status === 'cancelado') {
      backgroundColor = '#9ca3af';
      color = '#1f2937';
      textDecoration = 'line-through';
    } else if (status === 'finalizado') {
      backgroundColor = '#16a34a';
      color = '#ffffff';
    } else if (status !== 'confirmado') {
      backgroundColor = '#f59e0b';
    }

    // Eventos de indisponibilidade (status marcado acima como 'indisponivel')
    if ((event as any).id < 0 || status === 'indisponivel') {
      backgroundColor = '#ef4444'; // vermelho
      color = '#ffffff';
    }

    const style = {
      backgroundColor,
      borderRadius: '5px',
      opacity: 0.8,
      color,
      border: '0px',
      textDecoration,
    };
    return { style };
  };

  // PropGetter para desabilitar e ocultar dias bloqueados
  const dayPropGetter = (date: Date) => {
    if (!doutorAtual) {
      return {};
    }

    const diasBloqueados = doutorAtual.diasBloqueados || [];
    const diaSemana = moment(date).tz(BRAZIL_TZ).day();

    if (diasBloqueados.includes(diaSemana)) {
      return {
        className: 'rbc-day-blocked',
        style: {
          opacity: 0.15,
          pointerEvents: 'none' as const,
          backgroundColor: '#f5f5f5',
          cursor: 'not-allowed',
        },
      };
    }

    return {};
  };


  // Estado para armazenar horários do doutor
  const [horariosDoutor, setHorariosDoutor] = useState<Record<number, { inicio: string; fim: string }>>({});

  // Carregar horários do doutor
  useEffect(() => {
    const loadHorarios = async () => {
      if (doutorAtual?.id) {
        try {
          const horarios = await getHorariosByDoutor(doutorAtual.id);
          const horariosMap: Record<number, { inicio: string; fim: string }> = {};
          horarios.forEach(h => {
            if (h.ativo && h.inicio && h.fim) {
              horariosMap[h.diaSemana] = { inicio: h.inicio, fim: h.fim };
            }
          });
          setHorariosDoutor(horariosMap);
        } catch (err) {
          console.error('Erro ao carregar horários do doutor:', err);
        }
      } else {
        setHorariosDoutor({});
      }
    };
    loadHorarios();
  }, [doutorAtual]);

  // Calcular horários mínimos e máximos do calendário baseado no horário do doutor
  const getCalendarMinMax = () => {
    // Se não houver doutor selecionado ou horários, usar horários padrão
    if (!doutorAtual || Object.keys(horariosDoutor).length === 0) {
      return { min: new Date(2024, 0, 1, 8, 0, 0), max: new Date(2024, 0, 1, 20, 0, 0) };
    }

    // Encontrar o menor horário de início e o maior horário de fim entre todos os dias
    let minHora = 23;
    let minMinuto = 59;
    let maxHora = 0;
    let maxMinuto = 0;

    Object.values(horariosDoutor).forEach(horario => {
      const [inicioHora, inicioMinuto] = horario.inicio.split(':').map(Number);
      const [fimHora, fimMinuto] = horario.fim.split(':').map(Number);

      if (inicioHora < minHora || (inicioHora === minHora && inicioMinuto < minMinuto)) {
        minHora = inicioHora;
        minMinuto = inicioMinuto;
      }

      if (fimHora > maxHora || (fimHora === maxHora && fimMinuto > maxMinuto)) {
        maxHora = fimHora;
        maxMinuto = fimMinuto;
      }
    });

    // Se não encontrou nenhum horário válido, usar padrão
    if (minHora === 23 && minMinuto === 59) {
      return { min: new Date(2024, 0, 1, 8, 0, 0), max: new Date(2024, 0, 1, 20, 0, 0) };
    }

    // Criar datas base para calcular min/max (usar uma data fixa como referência)
    const min = new Date(2024, 0, 1, minHora, minMinuto, 0);
    const max = new Date(2024, 0, 1, maxHora, maxMinuto, 0);

    return { min, max };
  };

  const { min, max } = getCalendarMinMax();

  // Validar eventos com useMemo para garantir que sempre sejam válidos
  // IMPORTANTE: useMemo deve ser chamado ANTES de qualquer early return para seguir as regras dos hooks
  const eventosValidados = useMemo(() => {
    try {
      if (!Array.isArray(eventos)) {
        console.warn('Eventos não é um array:', eventos);
        return [];
      }

      // Criar um novo array para evitar mutações
      const validados: CalendarEvent[] = [];
      
      for (let i = 0; i < eventos.length; i++) {
        const evento = eventos[i];
        
        // Validação rigorosa
        if (!evento || typeof evento !== 'object' || Array.isArray(evento)) {
          console.warn(`Evento inválido no índice ${i}:`, evento);
          continue;
        }
        
        if (!evento.title || typeof evento.title !== 'string' || evento.title.trim() === '') {
          console.warn(`Evento sem title válido no índice ${i}:`, evento);
          continue;
        }
        
        if (!evento.start || !(evento.start instanceof Date) || isNaN(evento.start.getTime())) {
          console.warn(`Evento com start inválido no índice ${i}:`, evento);
          continue;
        }
        
        if (!evento.end || !(evento.end instanceof Date) || isNaN(evento.end.getTime())) {
          console.warn(`Evento com end inválido no índice ${i}:`, evento);
          continue;
        }
        
        // Criar um novo objeto para garantir imutabilidade
        try {
          validados.push({
            id: evento.id ?? 0,
            title: String(evento.title).trim(),
            start: new Date(evento.start.getTime()), // Criar nova instância de Date
            end: new Date(evento.end.getTime()), // Criar nova instância de Date
            resource: evento.resource || {},
          });
        } catch (err) {
          console.error(`Erro ao criar evento no índice ${i}:`, err, evento);
          continue;
        }
      }

      // Garantir que retornamos sempre um array válido e não-nulo
      // Verificação final: garantir que não há undefined no array
      const finalArray = Array.isArray(validados) ? validados.filter((e) => e !== null && e !== undefined) : [];
      
      // Log para debug se houver problemas
      if (eventos.length > 0 && finalArray.length === 0) {
        console.warn('Todos os eventos foram filtrados!', eventos);
      }
      
      return finalArray;
    } catch (err) {
      console.error('Erro ao validar eventos:', err, eventos);
      return [];
    }
  }, [eventos]);

  const handleSelectDoutor = (doutor: IDoutor) => {
    setDoutorAgendaSelecionado(doutor);
    setIsSelectDoutorModalOpen(false);
  };

  // Se ainda estiver carregando doutores (e não for SECRETARIA), mostrar loading
  if (loadingDoutores && user?.role !== 'SECRETARIA') {
    return <CircularProgress />;
  }

  // Se for SECRETARIA e ainda estiver carregando o contexto, mostrar loading
  if (user?.role === 'SECRETARIA' && isLoadingDoutorContext) {
    return <CircularProgress />;
  }

  // Verificar se a clínica possui módulo de agenda habilitado
  // Para DOUTOR, sempre permitir agenda (não depende da clínica ser carregada)
  const possuiAgenda = user?.role === 'SUPER_ADMIN' || user?.role === 'DOUTOR' || clinica?.possuiAgenda !== false;

  // Se não houver doutor selecionado, mostrar apenas o modal de seleção (ou nada se não houver doutores)
  // Para SECRETARIA, não mostrar modal aqui (já está no menu lateral)
  if (!doutorAtual) {
    if (user?.role === 'SECRETARIA') {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Selecione um doutor no menu lateral para visualizar a agenda.
          </Typography>
        </Box>
      );
    }
    
    // Se a agenda estiver desabilitada, não mostrar modal
    if (!possuiAgenda) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            O módulo de agenda está desabilitado para esta clínica.
          </Typography>
        </Box>
      );
    }
    
    return (
      <>
        <SelectDoutorModal
          open={isSelectDoutorModalOpen}
          onClose={() => setIsSelectDoutorModalOpen(false)}
          onSelect={handleSelectDoutor}
          doutores={doutores}
          title="Selecionar Agenda do Doutor"
        />
        {doutores.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Nenhum doutor cadastrado.
            </Typography>
          </Box>
        )}
      </>
    );
  }

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 1, md: 0 },
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          mb: 2,
          px: { xs: 1, md: 2 },
        }}
      >
        <Tooltip title="Gerenciar Disponibilidades">
          <IconButton
            color="primary"
            onClick={handleOpenIndisponibilidadeModal}
            sx={{
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            <AccessTimeIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          flex: 1,
          p: { xs: 1, md: 2 },
          pb: { xs: 2, md: 3 },
          backgroundColor: 'white',
          borderRadius: { xs: 2, md: 3 },
          boxShadow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          '& .rbc-calendar': {
            flexGrow: 1,
            minWidth: 0,
            height: '100%',
            paddingBottom: theme.spacing(isSmallScreen ? 2 : 3),
          },
          '& .rbc-time-view': {
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          },
          '& .rbc-time-content': {
            flexGrow: 1,
            overflowY: 'auto',
            pb: 3,
          },
          // Ocultar completamente dias bloqueados
          '& .rbc-day-blocked': {
            display: 'none !important',
            visibility: 'hidden !important',
            width: '0 !important',
            minWidth: '0 !important',
            maxWidth: '0 !important',
            padding: '0 !important',
            margin: '0 !important',
            border: 'none !important',
          },
          // Na visualização de semana/mês, ocultar colunas de dias bloqueados
          '& .rbc-header.rbc-day-blocked': {
            display: 'none !important',
            visibility: 'hidden !important',
            width: '0 !important',
            minWidth: '0 !important',
          },
          // Ocultar células de background de dias bloqueados
          '& .rbc-day-bg.rbc-day-blocked': {
            display: 'none !important',
          },
        }}
      >
        <ErrorBoundary
          fallback={
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" color="error">
                Erro ao carregar o calendário. Por favor, recarregue a página.
              </Typography>
            </Box>
          }
        >
          <SafeCalendar
            localizer={localizer}
            events={eventosValidados}
            startAccessor="start"
            endAccessor="end"
            culture="pt-br"
            style={{ minHeight: isSmallScreen ? 420 : 0, width: '100%', height: '100%', flex: 1 }}
            messages={messages}
            formats={formats}
            defaultView={isSmallScreen ? 'agenda' : 'week'}
            views={isSmallScreen ? ['day', 'agenda'] : ['month', 'week', 'day', 'agenda']}
            step={30}
            timeslots={2}
            selectable
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            eventPropGetter={eventStyleGetter}
            dayPropGetter={dayPropGetter}
            dayLayoutAlgorithm="no-overlap"
            min={min}
            max={max}
          />
        </ErrorBoundary>
      </Box>

      <AgendamentoFormModal
        open={isFormModalOpen}
        onClose={handleCloseModals}
        onSubmit={handleSubmitForm}
        initialData={selectedSlot}
        agendamento={selectedEvent}
        doutorId={doutorAtual?.id}
        onRequestDelete={handleDeleteRequest}
        onRequestIndisponibilidade={() => {
          if (selectedEvent?.doutor?.id) {
            setSelectedDoutor({ id: selectedEvent.doutor.id, nome: selectedEvent.doutor.nome, email: '', role: 'DOUTOR' } as IDoutor);
            setIndisponibilidadeEditando(null);
            setIsFormModalOpen(false);
            setIsIndisponibilidadeModalOpen(true);
          }
        }}
      />

      <ConfirmationModal
        open={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDelete}
        title="Excluir Agendamento"
        message={`Tem certeza que deseja excluir o agendamento de ${selectedEvent?.paciente?.nome}?`}
      />

        <IndisponibilidadeManagerModal
        open={isIndisponibilidadeModalOpen}
        onClose={handleCloseIndisponibilidadeModal}
        doutorId={selectedDoutor?.id || doutorAtual?.id || user?.id}
        doutorNome={selectedDoutor?.nome || doutorAtual?.nome}
        indisponibilidadeEditando={indisponibilidadeEditando}
      />

      {/* Para SECRETARIA, não mostrar modal de seleção aqui (já está no menu lateral) */}
      {user?.role !== 'SECRETARIA' && possuiAgenda && (
        <SelectDoutorModal
          open={isSelectDoutorModalOpen}
          onClose={() => setIsSelectDoutorModalOpen(false)}
          onSelect={handleSelectDoutor}
          doutores={doutores}
          title="Selecionar Agenda do Doutor"
        />
      )}

      <AlterarPausaModal
        open={isAlterarPausaModalOpen}
        onClose={() => {
          setIsAlterarPausaModalOpen(false);
          setPausaSelecionada(null);
        }}
        onConfirm={() => {
          // Recarregar agendamentos para atualizar eventos de pausa
          fetchAgendamentos();
        }}
        data={pausaSelecionada?.data || new Date()}
        doutorId={pausaSelecionada?.doutorId}
        horarioInicioAtual={pausaSelecionada?.horarioInicio}
        horarioFimAtual={pausaSelecionada?.horarioFim}
      />
    </Box>
  );
};
