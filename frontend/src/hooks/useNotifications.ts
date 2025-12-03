import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { playNotificationSound } from '../utils/notificationSound';

// Cache para evitar notificações duplicadas (mesmo agendamento em menos de 2 segundos)
const notificationCache = new Map<string, number>();
const NOTIFICATION_DEBOUNCE_MS = 2000; // 2 segundos

export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: {
    agendamentoId?: number;
    doutorId?: number;
    url?: string;
  };
}

interface UseNotificationsOptions {
  enabled?: boolean;
  requestPermission?: boolean;
  onNotificationClick?: (data: NotificationData) => void;
}

/**
 * Hook para gerenciar notificações do navegador
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, requestPermission: shouldRequestPermission = false, onNotificationClick } = options;
  
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSupported, setIsSupported] = useState(false);
  const serviceWorkerRegistration = useRef<ServiceWorkerRegistration | null>(null);

  // Verificar suporte
  useEffect(() => {
    const supported = 
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator;
    
    setIsSupported(supported);
    
    if (supported && typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  // Registrar Service Worker
  useEffect(() => {
    if (!enabled || !isSupported) return;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        
        serviceWorkerRegistration.current = registration;
        console.log('[Notifications] Service Worker registrado:', registration);
        
        // Aguardar Service Worker estar ativo
        if (registration.installing) {
          console.log('[Notifications] Service Worker instalando...');
        } else if (registration.waiting) {
          console.log('[Notifications] Service Worker aguardando...');
        } else if (registration.active) {
          console.log('[Notifications] Service Worker ativo');
        }
      } catch (error) {
        console.error('[Notifications] Erro ao registrar Service Worker:', error);
      }
    };

    registerServiceWorker();
  }, [enabled, isSupported]);

  // Solicitar permissão
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !enabled) {
      console.warn('[Notifications] Notificações não suportadas ou desabilitadas');
      return false;
    }

    if (permission === 'granted') {
      return true;
    }

    if (permission === 'denied') {
      console.warn('[Notifications] Permissão negada pelo usuário');
      toast.error('Permissão de notificações foi negada. Por favor, habilite nas configurações do navegador.');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast.success('Notificações habilitadas!');
        return true;
      } else {
        toast.warning('Permissão de notificações negada.');
        return false;
      }
    } catch (error) {
      console.error('[Notifications] Erro ao solicitar permissão:', error);
      toast.error('Erro ao solicitar permissão de notificações.');
      return false;
    }
  }, [isSupported, enabled, permission]);

  // Solicitar permissão automaticamente se solicitado
  useEffect(() => {
    if (shouldRequestPermission && enabled && isSupported && permission === 'default') {
      requestPermission();
    }
  }, [shouldRequestPermission, enabled, isSupported, permission, requestPermission]);

  // Mostrar notificação local (quando a página está aberta)
  const showLocalNotification = useCallback((data: NotificationData) => {
    if (!enabled) return;

    // Verificar se já foi mostrada recentemente (evitar duplicação)
    const cacheKey = data.tag || `${data.data?.agendamentoId || 'unknown'}-${data.title}`;
    const lastShown = notificationCache.get(cacheKey);
    const now = Date.now();
    
    if (lastShown && (now - lastShown) < NOTIFICATION_DEBOUNCE_MS) {
      console.log('[Notifications] Notificação duplicada ignorada:', cacheKey);
      return;
    }
    
    // Atualizar cache
    notificationCache.set(cacheKey, now);
    
    // Limpar cache antigo (manter apenas últimas 10 notificações)
    if (notificationCache.size > 10) {
      const oldestKey = Array.from(notificationCache.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
      notificationCache.delete(oldestKey);
    }

    // Reproduzir som
    playNotificationSound();

    // Mostrar toast
    toast.info(data.title, {
      description: data.body,
      duration: 5000,
      action: data.data?.agendamentoId ? {
        label: 'Ver',
        onClick: () => {
          if (onNotificationClick) {
            onNotificationClick(data);
          } else if (data.data?.url) {
            window.location.href = data.data.url;
          }
        },
      } : undefined,
    });
  }, [enabled, onNotificationClick]);

  // Mostrar notificação do navegador (Web Push)
  const showBrowserNotification = useCallback(async (data: NotificationData) => {
    if (!enabled || !isSupported) return;

    // Se não tiver permissão, tentar solicitar
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        // Se não conseguir permissão, não fazer nada (toast já foi mostrado em showLocalNotification)
        return;
      }
    }

    try {
      // Tentar usar Service Worker primeiro (para funcionar mesmo com página fechada)
      if (serviceWorkerRegistration.current) {
        await serviceWorkerRegistration.current.showNotification(data.title, {
          body: data.body,
          icon: data.icon || '/icon-192x192.svg',
          badge: '/icon-192x192.svg',
          tag: data.tag || 'agendamento',
          requireInteraction: false,
          data: data.data || {},
          vibrate: [200, 100, 200],
          actions: [
            {
              action: 'open',
              title: 'Ver Agendamento',
            },
          ],
        });
        console.log('[Notifications] Notificação do navegador exibida via Service Worker');
      } else if (typeof Notification !== 'undefined') {
        // Fallback: usar Notification API diretamente
        const notification = new Notification(data.title, {
          body: data.body,
          icon: data.icon || '/icon-192x192.png',
          tag: data.tag || 'agendamento',
          data: data.data || {},
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          if (onNotificationClick) {
            onNotificationClick(data);
          } else if (data.data?.url) {
            window.location.href = data.data.url;
          }
        };
      }

      // Não mostrar toast aqui - já foi mostrado em showLocalNotification
      // Apenas exibir a notificação do navegador
      console.log('[Notifications] Notificação do navegador exibida');
    } catch (error) {
      console.error('[Notifications] Erro ao exibir notificação do navegador:', error);
      // Fallback: mostrar apenas notificação local (já foi mostrada)
    }
  }, [enabled, isSupported, permission, requestPermission, onNotificationClick]);

  // Mostrar notificação (escolhe automaticamente o melhor método)
  const showNotification = useCallback(async (data: NotificationData) => {
    if (!enabled) return;

    // Sempre mostrar notificação local primeiro (toast + som) - apenas uma vez
    showLocalNotification(data);

    // Se tiver permissão, mostrar também notificação do navegador (sem toast duplicado)
    if (permission === 'granted') {
      await showBrowserNotification(data);
    }
  }, [enabled, permission, showLocalNotification, showBrowserNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    showLocalNotification,
    showBrowserNotification,
    serviceWorkerRegistration: serviceWorkerRegistration.current,
  };
}

