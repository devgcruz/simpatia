import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/dist/locale/pt-br';
import { Box, Typography, CircularProgress } from '@mui/material';
import { toast } from 'sonner';
import { getAgendamentos } from '../services/agendamento.service';
import { IAgendamento } from '../types/models';

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

  const formatarEventos = (agendamentos: IAgendamento[]) =>
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

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box sx={{ height: '80vh' }}>
      <Typography variant="h4" gutterBottom>
        Agenda da Clínica
      </Typography>
      <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
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
        />
      </Box>
    </Box>
  );
};
