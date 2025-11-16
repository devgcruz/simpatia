import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import { Box, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
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
import { IAgendamento, IClinica } from '../types/models';

import { AgendamentoFormModal } from '../components/agendamentos/AgendamentoFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import { getMinhaClinica } from '../services/clinica.service';

moment.updateLocale('pt-br', {
  week: { dow: 1, doy: 4 },
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

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  const fetchAgendamentos = async () => {
    try {
      setLoading(true);
      const data: IAgendamento[] = await getAgendamentos();
      const eventosFormatados = formatarEventos(data);
      setEventos(eventosFormatados);
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

  useEffect(() => {
    fetchAgendamentos();
  }, []);

  useEffect(() => {
    if (user?.clinicaId) {
      fetchClinica();
    }
  }, [user?.clinicaId]);

  const handleSelectEvent = (event: CalendarEvent) => {
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
        onRequestDelete={handleDeleteRequest}
        onFinalize={handleFinalizeAgendamento}
      />

      <ConfirmationModal
        open={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDelete}
        title="Excluir Agendamento"
        message={`Tem certeza que deseja excluir o agendamento de ${selectedEvent?.paciente?.nome}?`}
      />
    </Box>
  );
};
