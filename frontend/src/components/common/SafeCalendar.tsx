import React, { useMemo } from 'react';
import { Calendar, CalendarProps, momentLocalizer } from 'react-big-calendar';
import moment from 'moment-timezone';

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource?: any;
}

interface SafeCalendarProps extends Omit<CalendarProps, 'events'> {
  events: CalendarEvent[];
  localizer: ReturnType<typeof momentLocalizer>;
}

/**
 * Componente wrapper seguro para o Calendar que garante que apenas eventos válidos sejam passados
 */
export const SafeCalendar: React.FC<SafeCalendarProps> = ({ events, localizer, ...props }) => {
  // Validar e filtrar eventos de forma extremamente rigorosa
  const safeEvents = useMemo(() => {
    if (!Array.isArray(events)) {
      console.warn('SafeCalendar: events não é um array', events);
      return [];
    }

    const validEvents: CalendarEvent[] = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Validação rigorosa passo a passo
      if (event === null || event === undefined) {
        console.warn(`SafeCalendar: Evento null/undefined no índice ${i}`);
        continue;
      }

      if (typeof event !== 'object' || Array.isArray(event)) {
        console.warn(`SafeCalendar: Evento não é um objeto válido no índice ${i}`, typeof event, event);
        continue;
      }

      // Verificar title
      if (!event.title || typeof event.title !== 'string' || event.title.trim() === '') {
        console.warn(`SafeCalendar: Evento sem title válido no índice ${i}`, event);
        continue;
      }

      // Verificar start
      if (!event.start) {
        console.warn(`SafeCalendar: Evento sem start no índice ${i}`, event);
        continue;
      }

      if (!(event.start instanceof Date)) {
        console.warn(`SafeCalendar: Evento com start que não é Date no índice ${i}`, typeof event.start, event);
        continue;
      }

      if (isNaN(event.start.getTime())) {
        console.warn(`SafeCalendar: Evento com start inválido (NaN) no índice ${i}`, event);
        continue;
      }

      // Verificar end
      if (!event.end) {
        console.warn(`SafeCalendar: Evento sem end no índice ${i}`, event);
        continue;
      }

      if (!(event.end instanceof Date)) {
        console.warn(`SafeCalendar: Evento com end que não é Date no índice ${i}`, typeof event.end, event);
        continue;
      }

      if (isNaN(event.end.getTime())) {
        console.warn(`SafeCalendar: Evento com end inválido (NaN) no índice ${i}`, event);
        continue;
      }

      // Criar novo objeto para garantir imutabilidade
      try {
        validEvents.push({
          id: Number(event.id) || 0,
          title: String(event.title).trim(),
          start: new Date(event.start.getTime()),
          end: new Date(event.end.getTime()),
          resource: event.resource || {},
        });
      } catch (err) {
        console.error(`SafeCalendar: Erro ao criar evento no índice ${i}:`, err, event);
        continue;
      }
    }

    // Log final para debug
    if (events.length > 0 && validEvents.length === 0) {
      console.warn('SafeCalendar: Todos os eventos foram filtrados!', events);
    } else if (events.length !== validEvents.length) {
      console.warn(`SafeCalendar: Eventos filtrados: ${events.length} -> ${validEvents.length}`);
    }

    return validEvents;
  }, [events]);

  // Se não houver eventos válidos, retornar Calendar vazio
  if (safeEvents.length === 0 && events.length > 0) {
    console.warn('SafeCalendar: Nenhum evento válido encontrado, renderizando Calendar vazio');
  }

  // Validação final EXTREMAMENTE rigorosa antes de passar para o Calendar
  // Garantir que o array seja completamente limpo
  const finalEvents = safeEvents.filter((e, index) => {
    if (!e || typeof e !== 'object') {
      console.error(`SafeCalendar: Evento inválido no índice ${index} (final check):`, e);
      return false;
    }
    if (!e.title || typeof e.title !== 'string') {
      console.error(`SafeCalendar: Evento sem title no índice ${index} (final check):`, e);
      return false;
    }
    if (!e.start || !(e.start instanceof Date) || isNaN(e.start.getTime())) {
      console.error(`SafeCalendar: Evento com start inválido no índice ${index} (final check):`, e);
      return false;
    }
    if (!e.end || !(e.end instanceof Date) || isNaN(e.end.getTime())) {
      console.error(`SafeCalendar: Evento com end inválido no índice ${index} (final check):`, e);
      return false;
    }
    return true;
  });

  // Log final para debug (apenas se houver diferença)
  if (finalEvents.length !== safeEvents.length) {
    console.warn('SafeCalendar: Eventos filtrados na validação final:', safeEvents.length, '->', finalEvents.length);
  }

  // Garantir que sempre seja um array válido e criar uma cópia para evitar mutações
  const eventsToPass: CalendarEvent[] = Array.isArray(finalEvents) 
    ? finalEvents.map((e) => ({
        id: Number(e.id) || 0,
        title: String(e.title || '').trim(),
        start: new Date(e.start.getTime()),
        end: new Date(e.end.getTime()),
        resource: e.resource || {},
      }))
    : [];

  // Verificação final EXTREMA: garantir que nenhum evento seja undefined
  const finalSafeEvents = eventsToPass.filter((e, idx) => {
    const isValid = e && 
                    typeof e === 'object' && 
                    e.title && 
                    typeof e.title === 'string' && 
                    e.title.trim() !== '' &&
                    e.start instanceof Date && 
                    !isNaN(e.start.getTime()) &&
                    e.end instanceof Date && 
                    !isNaN(e.end.getTime());
    
    if (!isValid) {
      console.error(`SafeCalendar: Evento inválido detectado na verificação final no índice ${idx}:`, e);
    }
    
    return isValid;
  });

  return <Calendar {...props} localizer={localizer} events={finalSafeEvents} />;
};

