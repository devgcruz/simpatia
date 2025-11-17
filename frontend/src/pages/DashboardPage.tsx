import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import { Box, CircularProgress, useMediaQuery, useTheme, IconButton, Tooltip, Typography, Button } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { toast } from 'sonner';

import {
  getAgendamentos,
  createAgendamento,
  updateAgendamento,
  deleteAgendamento,
  AgendamentoCreateInput,
  AgendamentoUpdateInput,
  finalizeAgendamento,
} from '../services/agendamento.service';
import { IAgendamento, IClinica, IDoutor } from '../types/models';

import { AgendamentoFormModal } from '../components/agendamentos/AgendamentoFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import { getMinhaClinica } from '../services/clinica.service';
import { Indisponibilidade } from '../services/indisponibilidade.service';
import { IndisponibilidadeManagerModal } from '../components/doutores/IndisponibilidadeManagerModal';
import { getDoutores } from '../services/doutor.service';
import { SelectDoutorModal } from '../components/common/SelectDoutorModal';
import { listarIndisponibilidadesDoDoutor } from '../services/indisponibilidade.service';
import { AlterarPausaModal } from '../components/common/AlterarPausaModal';
import { listarExcecoesDoDoutor, PausaExcecao } from '../services/pausa-excecao.service';

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

  const [eventos, setEventos] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinica, setClinica] = useState<IClinica | null>(null);
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [doutorAgendaSelecionado, setDoutorAgendaSelecionado] = useState<IDoutor | null>(null);
  const [isSelectDoutorModalOpen, setIsSelectDoutorModalOpen] = useState(false);
  const [loadingDoutores, setLoadingDoutores] = useState(true);

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
    agendamentos.map((ag) => ({
      id: ag.id,
      title: `${ag.paciente.nome} (${ag.servico.nome})`,
      start: new Date(ag.dataHora),
      end: moment(ag.dataHora).add(ag.servico.duracaoMin, 'minutes').toDate(),
      resource: ag,
    }));

  const criarEventosPausa = async (doutorId?: number): Promise<CalendarEvent[]> => {
    const eventosPausa: CalendarEvent[] = [];
    const hoje = moment().startOf('day');
    let indexCounter = 0;

    // Buscar exceções de pausa do doutor se houver doutor selecionado
    let excecoesDoutor: PausaExcecao[] = [];
    if (doutorId) {
      try {
        const dataInicio = hoje.format('YYYY-MM-DD');
        const dataFim = hoje.clone().add(365, 'days').format('YYYY-MM-DD');
        excecoesDoutor = await listarExcecoesDoDoutor(doutorId, dataInicio, dataFim);
      } catch (err) {
        console.error('Erro ao buscar exceções de pausa do doutor:', err);
      }
    }
    
    // Eventos de pausa da clínica (se configurado) - sempre mostrar
    if (clinica?.pausaInicio && clinica?.pausaFim) {
      for (let i = 0; i < 365; i++) {
        const data = hoje.clone().add(i, 'days');
        
        // Verificar se há exceção de pausa para esta data da clínica
        // (Por enquanto, não implementamos exceções de clínica, apenas de doutor)
        
        const [inicioHora, inicioMinuto] = clinica.pausaInicio.split(':').map(Number);
        const [fimHora, fimMinuto] = clinica.pausaFim.split(':').map(Number);
        
        const inicioPausa = data.clone().hour(inicioHora).minute(inicioMinuto).second(0).toDate();
        const fimPausa = data.clone().hour(fimHora).minute(fimMinuto).second(0).toDate();
        const dataStr = data.format('YYYY-MM-DD');
        
        eventosPausa.push({
          id: -1000000 - indexCounter++,
          title: 'Horário da Pausa',
          start: inicioPausa,
          end: fimPausa,
          resource: {
            id: 0,
            dataHora: inicioPausa.toISOString(),
            status: 'pausa',
            paciente: { id: 0, nome: 'Pausa', telefone: '', clinicaId: 0 },
            doutor: { id: 0, nome: '', email: '', role: 'DOUTOR' as const, clinicaId: 0 },
            servico: { id: 0, nome: 'Pausa', descricao: '', duracaoMin: 0, preco: 0, clinicaId: 0 },
            pausaData: dataStr,
            pausaInicio: clinica.pausaInicio,
            pausaFim: clinica.pausaFim,
          } as any,
        });
      }
    }
    
    // Se não houver doutor selecionado, não mostrar eventos de pausa dos doutores
    if (!doutorId) {
      return eventosPausa;
    }
    
    // Eventos de pausa do doutor selecionado
    try {
      const doutor = doutores.find((d) => d.id === doutorId);
      if (!doutor) {
        return eventosPausa;
      }

      // Eventos de dias bloqueados do doutor (dia inteiro) - verificar primeiro
      const diasBloqueadosDoutor = doutor.diasBloqueados || [];

      // Eventos de horário de almoço do doutor (apenas em dias não bloqueados)
      const pausaInicioDefault = doutor.pausaInicio;
      const pausaFimDefault = doutor.pausaFim;
      
      if (pausaInicioDefault && pausaFimDefault) {
        for (let i = 0; i < 365; i++) {
          const data = hoje.clone().add(i, 'days');
          const diaSemana = data.day(); // 0 = Domingo, 6 = Sábado
          const dataStr = data.format('YYYY-MM-DD');

          // Só criar evento de horário de almoço se o dia NÃO estiver bloqueado
          if (!diasBloqueadosDoutor.includes(diaSemana)) {
            // Verificar se há exceção de pausa para esta data
            // Formatar data da exceção para comparar (usar UTC para evitar problemas de fuso horário)
            // Se houver múltiplas exceções para a mesma data (não deveria acontecer), pegar a mais recente
            const excecoesParaData = excecoesDoutor
              .map((ex) => ({
                ...ex,
                // Usar UTC para formatar a data corretamente (evitar problemas de fuso horário)
                excecaoDataStr: moment.utc(ex.data).format('YYYY-MM-DD'),
              }))
              .filter((ex) => ex.excecaoDataStr === dataStr)
              .sort((a, b) => {
                // Ordenar por createdAt desc para pegar a mais recente
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
              });
            
            const excecao = excecoesParaData[0]; // Pegar a primeira (mais recente)
            const pausaInicio = excecao ? excecao.pausaInicio : pausaInicioDefault;
            const pausaFim = excecao ? excecao.pausaFim : pausaFimDefault;
            
            const [inicioHora, inicioMinuto] = pausaInicio.split(':').map(Number);
            const [fimHora, fimMinuto] = pausaFim.split(':').map(Number);
            
            const inicioPausa = data.clone().hour(inicioHora).minute(inicioMinuto).second(0).toDate();
            const fimPausa = data.clone().hour(fimHora).minute(fimMinuto).second(0).toDate();
            
            eventosPausa.push({
              id: -1000000 - indexCounter++,
              title: `Pausa \n (${doutor.nome})`,
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
            });
          }
        }
      }

      // Eventos de dias bloqueados do doutor (dia inteiro)
      if (diasBloqueadosDoutor.length > 0) {
        for (let i = 0; i < 365; i++) {
          const data = hoje.clone().add(i, 'days');
          const diaSemana = data.day(); // 0 = Domingo, 6 = Sábado

          // Se este dia da semana está bloqueado para este doutor
          if (diasBloqueadosDoutor.includes(diaSemana)) {
            const inicioDia = data.clone().hour(0).minute(0).second(0).toDate();
            const fimDia = data.clone().hour(23).minute(59).second(59).toDate();

            eventosPausa.push({
              id: -2000000 - indexCounter++,
              title: `Não há expediente \n\n (${doutor.nome})`,
              start: inicioDia,
              end: fimDia,
              resource: {
                id: 0,
                dataHora: inicioDia.toISOString(),
                status: 'pausa',
                paciente: { id: 0, nome: 'Dia Bloqueado', telefone: '', clinicaId: 0 },
                doutor: { id: doutor.id, nome: doutor.nome, email: doutor.email, role: doutor.role, clinicaId: doutor.clinicaId || 0 },
                servico: { id: 0, nome: 'Dia Bloqueado', descricao: '', duracaoMin: 0, preco: 0, clinicaId: 0 },
              } as any,
            });
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar doutor para eventos de pausa:', err);
    }
    
    return eventosPausa;
  };

  const fetchAgendamentos = async () => {
    if (!doutorAgendaSelecionado) {
      return;
    }

    try {
      setLoading(true);
      // Buscar agendamentos filtrados por doutor
      const data: IAgendamento[] = await getAgendamentos({ doutorId: doutorAgendaSelecionado.id });
      const eventosFormatados = formatarEventos(data);
      
      // Buscar indisponibilidades do doutor selecionado
      const indisps = await listarIndisponibilidadesDoDoutor(doutorAgendaSelecionado.id);
      const eventosIndisp: CalendarEvent[] = indisps.map((i) => ({
        id: -i.id, // ids negativos para diferenciar
        title: `Indisponível${i.motivo ? ` (${i.motivo})` : ''}`,
        start: new Date(i.inicio),
        end: new Date(i.fim),
        resource: {
          id: 0,
          dataHora: i.inicio,
          status: 'indisponivel',
          paciente: { id: 0, nome: 'Indisponibilidade', telefone: '', clinicaId: 0 },
          doutor: { id: doutorAgendaSelecionado.id, nome: doutorAgendaSelecionado.nome, email: '', role: 'DOUTOR', clinicaId: 0 },
          servico: { id: 0, nome: 'Indisponibilidade', descricao: '', duracaoMin: 0, preco: 0, clinicaId: 0 },
        } as any,
      }));
      
      // Adicionar eventos de pausa (clínica + doutor selecionado)
      const eventosPausa = await criarEventosPausa(doutorAgendaSelecionado.id);
      
      setEventos([...eventosFormatados, ...eventosIndisp, ...eventosPausa]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const fetchClinica = async () => {
    if (!user?.clinicaId) return;
    try {
      const clinicaEncontrada = await getMinhaClinica();
      if (clinicaEncontrada) {
        setClinica(clinicaEncontrada);
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados da clínica:', err);
    }
  };

  const fetchDoutores = useCallback(async () => {
    try {
      setLoadingDoutores(true);
      const data = await getDoutores();
      setDoutores(data);
      
      // Se o usuário for DOUTOR, selecionar automaticamente a agenda dele
      if (user?.role === 'DOUTOR' && user.id) {
        // O backend já retorna apenas o doutor logado quando role é DOUTOR
        // Mas vamos garantir que seja o doutor correto
        const doutorLogado = data.find((d) => d.id === user.id) || (data.length === 1 ? data[0] : null);
        if (doutorLogado) {
          setDoutorAgendaSelecionado(doutorLogado);
        }
      } else {
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
      toast.error(err.response?.data?.message || 'Erro ao buscar doutores');
    } finally {
      setLoadingDoutores(false);
    }
  }, [user?.role, user?.id]);

  useEffect(() => {
    if (user?.clinicaId) {
      fetchDoutores();
      fetchClinica();
    }
  }, [user?.clinicaId, fetchDoutores]);

  // Recarregar agendamentos quando o doutor selecionado mudar
  useEffect(() => {
    if (doutorAgendaSelecionado) {
      fetchAgendamentos();
    }
  }, [doutorAgendaSelecionado]);

  // Recarregar agendamentos quando a clínica mudar (para atualizar eventos de pausa)
  useEffect(() => {
    if (clinica && doutorAgendaSelecionado) {
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
    
    // Verificar se é uma indisponibilidade (id negativo ou status 'indisponivel')
    if (event.id < 0 || resource?.status === 'indisponivel') {
      // Se for evento de pausa (id muito negativo), abrir modal de alterar pausa
      if (event.id < -100000 && resource?.status === 'pausa') {
        // Verificar se é dia bloqueado (não permitir alterar pausa em dia bloqueado)
        if (event.title?.includes('Dia Bloqueado')) {
          return;
        }
        
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
        
        const doutorId = resource?.doutor?.id || doutorAgendaSelecionado?.id;
        const horarioInicio = resource?.pausaInicio || (resource?.doutor?.id ? doutorAgendaSelecionado?.pausaInicio : clinica?.pausaInicio);
        const horarioFim = resource?.pausaFim || (resource?.doutor?.id ? doutorAgendaSelecionado?.pausaFim : clinica?.pausaFim);
        
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
      if (doutorAgendaSelecionado) {
        listarIndisponibilidadesDoDoutor(doutorAgendaSelecionado.id).then((indisps) => {
          const indisponibilidade = indisps.find((ind) => ind.id === Math.abs(event.id));
          if (indisponibilidade) {
            setIndisponibilidadeEditando(indisponibilidade);
            setSelectedDoutor({ id: doutorAgendaSelecionado.id, nome: doutorAgendaSelecionado.nome, email: '', role: 'DOUTOR' } as IDoutor);
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

  const handleSubmitForm = async (data: AgendamentoCreateInput) => {
    try {
      if (selectedEvent) {
        const payload: AgendamentoUpdateInput = { ...data };
        await updateAgendamento(selectedEvent.id, payload);
        toast.success('Agendamento atualizado com sucesso!');
      } else {
        await createAgendamento(data);
        toast.success('Agendamento criado com sucesso!');
      }
      await fetchAgendamentos();
      handleCloseModals();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar agendamento');
    }
  };

  const handleFinalizeAgendamento = async (descricao: string) => {
    if (!selectedEvent) return;
    try {
      await finalizeAgendamento(selectedEvent.id, { descricao });
      toast.success('Consulta finalizada com sucesso!');
      await fetchAgendamentos();
      handleCloseModals();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao finalizar consulta');
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    try {
      await deleteAgendamento(selectedEvent.id);
      toast.success('Agendamento excluído com sucesso!');
      await fetchAgendamentos();
      handleCloseModals();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao apagar agendamento');
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const { status } = event.resource;
    let backgroundColor = '#2563eb';
    let color = 'white';
    let textDecoration: 'none' | 'line-through' = 'none';

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
          cursor: 'default',
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

  // Calcular horários mínimos e máximos do calendário baseado no horário de funcionamento
  const getCalendarMinMax = () => {
    if (!clinica?.horarioInicio || !clinica?.horarioFim) {
      // Se não houver horário configurado, usar horários padrão
      return { min: new Date(2024, 0, 1, 8, 0, 0), max: new Date(2024, 0, 1, 20, 0, 0) };
    }

    // Parse dos horários (formato "HH:MM")
    const [inicioHora, inicioMinuto] = clinica.horarioInicio.split(':').map(Number);
    const [fimHora, fimMinuto] = clinica.horarioFim.split(':').map(Number);

    // Criar datas base para calcular min/max (usar uma data fixa como referência)
    const min = new Date(2024, 0, 1, inicioHora, inicioMinuto, 0);
    const max = new Date(2024, 0, 1, fimHora, fimMinuto, 0);

    return { min, max };
  };

  const { min, max } = getCalendarMinMax();

  const handleSelectDoutor = (doutor: IDoutor) => {
    setDoutorAgendaSelecionado(doutor);
    setIsSelectDoutorModalOpen(false);
  };

  // Se ainda estiver carregando doutores, mostrar loading
  if (loadingDoutores) {
    return <CircularProgress />;
  }

  // Se não houver doutor selecionado, mostrar apenas o modal de seleção (ou nada se não houver doutores)
  if (!doutorAgendaSelecionado) {
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
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          px: { xs: 1, md: 2 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Agenda: {doutorAgendaSelecionado.nome}
          </Typography>
          {doutores.length > 1 && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsSelectDoutorModalOpen(true)}
            >
              Trocar Agenda
            </Button>
          )}
        </Box>
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
        }}
      >
        <Calendar
          localizer={localizer}
          events={eventos}
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
          dayLayoutAlgorithm="no-overlap"
          min={min}
          max={max}
        />
      </Box>

      <AgendamentoFormModal
        open={isFormModalOpen}
        onClose={handleCloseModals}
        onSubmit={handleSubmitForm}
        initialData={selectedSlot}
        agendamento={selectedEvent}
        doutorId={doutorAgendaSelecionado?.id}
        onRequestDelete={handleDeleteRequest}
        onRequestIndisponibilidade={() => {
          if (selectedEvent?.doutor?.id) {
            setSelectedDoutor({ id: selectedEvent.doutor.id, nome: selectedEvent.doutor.nome, email: '', role: 'DOUTOR' } as IDoutor);
            setIndisponibilidadeEditando(null);
            setIsFormModalOpen(false);
            setIsIndisponibilidadeModalOpen(true);
          }
        }}
        onFinalize={handleFinalizeAgendamento}
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
        doutorId={selectedDoutor?.id || doutorAgendaSelecionado?.id || user?.id}
        doutorNome={selectedDoutor?.nome || doutorAgendaSelecionado?.nome}
        indisponibilidadeEditando={indisponibilidadeEditando}
      />

      <SelectDoutorModal
        open={isSelectDoutorModalOpen}
        onClose={() => setIsSelectDoutorModalOpen(false)}
        onSelect={handleSelectDoutor}
        doutores={doutores}
        title="Selecionar Agenda do Doutor"
      />

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
