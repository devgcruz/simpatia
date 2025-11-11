import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/dist/locale/pt-br';
import { Box, Typography, CircularProgress } from '@mui/material';
import { toast } from 'sonner';

import {
  getAgendamentos,
  createAgendamento,
  updateAgendamento,
  deleteAgendamento,
  AgendamentoCreateInput,
  AgendamentoUpdateInput,
} from '../services/agendamento.service';
import { IAgendamento } from '../types/models';

import { AgendamentoFormModal } from '../components/agendamentos/AgendamentoFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

moment.locale('pt-br');
const localizer = momentLocalizer(moment);

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
    const style = {
      backgroundColor: event.resource.status === 'confirmado' ? '#2563eb' : '#f59e0b',
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block',
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
          defaultView="week"
          views={['month', 'week', 'day', 'agenda']}
          step={30}
          timeslots={2}
          selectable
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          eventPropGetter={eventStyleGetter}
        />
      </Box>

      <AgendamentoFormModal
        open={isFormModalOpen}
        onClose={handleCloseModals}
        onSubmit={handleSubmitForm}
        initialData={selectedSlot}
        agendamento={selectedEvent}
        onRequestDelete={handleDeleteRequest}
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
