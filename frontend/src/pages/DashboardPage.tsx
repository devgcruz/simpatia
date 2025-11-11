import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import { Box, Typography, CircularProgress } from '@mui/material';
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
import { IAgendamento } from '../types/models';

import { AgendamentoFormModal } from '../components/agendamentos/AgendamentoFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

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
  const [eventos, setEventos] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchAgendamentos();
  }, []);

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

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Agenda da Clínica
      </Typography>
      <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 3, boxShadow: 1, height: '80vh' }}>
        <Calendar
          localizer={localizer}
          events={eventos}
          startAccessor="start"
          endAccessor="end"
          culture="pt-br"
          style={{ minHeight: 600 }}
          messages={messages}
          formats={formats}
          defaultView="week"
          views={['month', 'week', 'day', 'agenda']}
          step={30}
          timeslots={2}
          selectable
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          eventPropGetter={eventStyleGetter}
          dayLayoutAlgorithm="no-overlap"
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
