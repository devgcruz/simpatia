import React, { createContext, useContext, useCallback, useRef } from 'react';
import { useNotifications, NotificationData } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import moment from 'moment';

interface NotificationContextType {
  showNotification: (data: NotificationData) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  permission: NotificationPermission;
  isSupported: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext deve ser usado dentro de NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();
  const isDoutor = user?.role === 'DOUTOR';
  const doutorId = isDoutor ? user?.id : null;

  const {
    isSupported,
    permission,
    requestPermission,
    showNotification: showNotificationHook,
  } = useNotifications({
    enabled: true,
    requestPermission: false, // Não solicitar automaticamente, apenas quando necessário
    onNotificationClick: (data) => {
      if (data.data?.url) {
        window.location.href = data.data.url;
      }
    },
  });

  // Cache para evitar processar o mesmo evento duas vezes
  // Usar um Set global compartilhado para evitar duplicação mesmo com múltiplas instâncias
  const processedEventsRef = useRef<Set<string>>(new Set());
  
  // Criar uma chave única para o evento baseada no agendamentoId e timestamp
  const getEventKey = (agendamentoId: number, timestamp?: string) => {
    return `agendamento-${agendamentoId}-${timestamp || Date.now()}`;
  };

  // Handler para eventos WebSocket de agendamento
  const handleAgendamentoWebSocket = useCallback((event: any) => {
    console.log('[NotificationContext] Evento WebSocket recebido:', event);

    // Verificar se o evento é para o doutor atual
    if (!isDoutor || !doutorId || event.doutorId !== doutorId) {
      return;
    }

    const agendamento = event.agendamento;
    
    // Processar diferentes tipos de eventos
    let notificationData: NotificationData | null = null;

    // 1. Novos agendamentos (criados por secretária, IA ou doutor)
    if (event.action === 'created' && agendamento && agendamento.id) {
      // Verificar se já processamos este agendamento (evitar duplicação)
      const agendamentoId = agendamento.id;
      const eventKey = `created-${agendamentoId}-${agendamento.dataHora}`;
      
      if (processedEventsRef.current.has(eventKey)) {
        console.log('[NotificationContext] Evento já processado, ignorando:', eventKey);
        return;
      }

      // Marcar como processado
      processedEventsRef.current.add(eventKey);
      console.log('[NotificationContext] Processando novo agendamento:', eventKey);
      
      // Limpar cache antigo (manter apenas últimos 100 eventos)
      if (processedEventsRef.current.size > 100) {
        const firstKey = Array.from(processedEventsRef.current)[0];
        processedEventsRef.current.delete(firstKey);
      }

      // Formatar data/hora do agendamento
      const dataHora = moment(agendamento.dataHora);
      const dataHoraFormatada = dataHora.format('DD/MM/YYYY [às] HH:mm');

      // Determinar se foi criado pela IA (geralmente são encaixes)
      const isCriadoPorIA = agendamento.isEncaixe === true;
      
      notificationData = {
        title: isCriadoPorIA ? 'Novo Agendamento (IA)' : 'Novo Agendamento',
        body: `${agendamento.paciente?.nome || 'Paciente'} - ${dataHoraFormatada}`,
        icon: '/icon-192x192.svg',
        tag: `agendamento-${agendamento.id}`,
        soundType: 'appointment', // Usar som de agendamento
        data: {
          agendamentoId: agendamento.id,
          doutorId: event.doutorId,
          url: '/atendimento-do-dia',
        },
      };
    }
    // 2. Agendamentos cancelados
    else if (event.action === 'updated' && agendamento && agendamento.id && agendamento.status === 'cancelado') {
      // Verificar se já processamos este cancelamento (evitar duplicação)
      const agendamentoId = agendamento.id;
      const eventKey = `cancelado-${agendamentoId}-${agendamento.dataHora || Date.now()}`;
      
      if (processedEventsRef.current.has(eventKey)) {
        console.log('[NotificationContext] Cancelamento já processado, ignorando:', eventKey);
        return;
      }

      // Marcar como processado
      processedEventsRef.current.add(eventKey);
      console.log('[NotificationContext] Processando cancelamento:', eventKey);
      
      // Limpar cache antigo
      if (processedEventsRef.current.size > 100) {
        const firstKey = Array.from(processedEventsRef.current)[0];
        processedEventsRef.current.delete(firstKey);
      }

      // Formatar data/hora do agendamento
      const dataHora = moment(agendamento.dataHora);
      const dataHoraFormatada = dataHora.format('DD/MM/YYYY [às] HH:mm');

      notificationData = {
        title: 'Agendamento Cancelado',
        body: `${agendamento.paciente?.nome || 'Paciente'} - ${dataHoraFormatada}`,
        icon: '/icon-192x192.svg',
        tag: `agendamento-cancelado-${agendamento.id}`,
        soundType: 'appointment', // Usar som de agendamento
        data: {
          agendamentoId: agendamento.id,
          doutorId: event.doutorId,
          url: '/atendimento-do-dia',
        },
      };
    }
    // 3. Reagendamentos e outras atualizações (quando dataHora ou status mudam)
    else if (event.action === 'updated' && agendamento && agendamento.id && agendamento.status !== 'cancelado') {
      // Verificar se já processamos esta atualização (evitar duplicação)
      const agendamentoId = agendamento.id;
      const eventKey = `updated-${agendamentoId}-${agendamento.dataHora}-${agendamento.status}`;
      
      if (processedEventsRef.current.has(eventKey)) {
        console.log('[NotificationContext] Atualização já processada, ignorando:', eventKey);
        return;
      }

      // Marcar como processado
      processedEventsRef.current.add(eventKey);
      console.log('[NotificationContext] Processando atualização de agendamento:', eventKey);
      
      // Limpar cache antigo
      if (processedEventsRef.current.size > 100) {
        const firstKey = Array.from(processedEventsRef.current)[0];
        processedEventsRef.current.delete(firstKey);
      }

      // Formatar data/hora do agendamento
      const dataHora = moment(agendamento.dataHora);
      const dataHoraFormatada = dataHora.format('DD/MM/YYYY [às] HH:mm');

      // Determinar o título baseado no status
      let title = 'Agendamento Atualizado';
      if (agendamento.status === 'confirmado') {
        title = 'Agendamento Confirmado';
      } else if (agendamento.status === 'encaixe_pendente') {
        title = 'Encaixe Pendente';
      } else if (agendamento.status === 'encaixe_confirmed') {
        title = 'Encaixe Confirmado';
      }

      notificationData = {
        title: title,
        body: `${agendamento.paciente?.nome || 'Paciente'} - ${dataHoraFormatada}`,
        icon: '/icon-192x192.svg',
        tag: `agendamento-updated-${agendamento.id}`,
        soundType: 'appointment', // Usar som de agendamento
        data: {
          agendamentoId: agendamento.id,
          doutorId: event.doutorId,
          url: '/atendimento-do-dia',
        },
      };
    }

    // Se não há notificação para mostrar, retornar
    if (!notificationData) {
      return;
    }

    // Mostrar notificação (toast + som + push)
    showNotificationHook(notificationData);
    
    // Disparar evento customizado para o NotificationBell
    window.dispatchEvent(new CustomEvent('notification:created', {
      detail: notificationData,
    }));
  }, [isDoutor, doutorId, showNotificationHook]);

  // Conectar WebSocket para escutar eventos de agendamento
  useWebSocket({
    doutorId: doutorId || null,
    enabled: !!user && isDoutor && !!doutorId,
    onAgendamentoUpdate: handleAgendamentoWebSocket,
  });

  const value: NotificationContextType = {
    showNotification: showNotificationHook,
    requestPermission,
    permission,
    isSupported,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

