import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  Button,
  Stack,
  Paper,
  Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import CloseIcon from '@mui/icons-material/Close';
import { useNotificationContext } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import moment from 'moment-timezone';
import 'moment/locale/pt-br';

// Garantir que o locale está configurado corretamente
moment.locale('pt-br');

// Função helper para formatar tempo relativo em português
const formatTimeAgo = (timestamp: Date): string => {
  // Garantir que o locale está ativo antes de formatar
  const m = moment(timestamp);
  
  // Forçar locale pt-br
  if (m.locale() !== 'pt-br') {
    moment.locale('pt-br');
  }
  
  return m.locale('pt-br').fromNow();
};

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: Date;
  data?: {
    agendamentoId?: number;
    doutorId?: number;
    url?: string;
  };
  read: boolean;
}

export function NotificationBell() {
  const { user } = useAuth();
  const isDoutor = user?.role === 'DOUTOR';
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
  const notificationIdRef = useRef(0);
  // Cache para evitar notificações duplicadas
  const notificationCacheRef = useRef<Map<string, number>>(new Map());
  const NOTIFICATION_DEBOUNCE_MS = 2000; // 2 segundos

  // Carregar notificações do localStorage ao montar
  useEffect(() => {
    if (!isDoutor) return;

    const savedNotifications = localStorage.getItem(`notifications_${user?.id}`);
    if (savedNotifications) {
      try {
        const parsed = JSON.parse(savedNotifications);
        // Converter timestamps de string para Date
        const notificationsWithDates = parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
        setNotifications(notificationsWithDates);
        notificationIdRef.current = Math.max(...parsed.map((n: any) => parseInt(n.id) || 0), 0);
      } catch (error) {
        console.error('Erro ao carregar notificações:', error);
      }
    }
  }, [isDoutor, user?.id]);

  // Salvar notificações no localStorage
  const saveNotifications = useCallback((newNotifications: NotificationItem[]) => {
    if (!isDoutor || !user?.id) return;
    try {
      localStorage.setItem(`notifications_${user?.id}`, JSON.stringify(newNotifications));
    } catch (error) {
      console.error('Erro ao salvar notificações:', error);
    }
  }, [isDoutor, user?.id]);

  // Adicionar nova notificação
  const addNotification = useCallback((title: string, body: string, data?: NotificationItem['data']) => {
    if (!isDoutor) return;

    // Verificar se já foi adicionada recentemente (evitar duplicação)
    // Usar agendamentoId como chave principal (sem timestamp) para evitar duplicatas do mesmo agendamento
    const cacheKey = data?.agendamentoId 
      ? `agendamento-${data.agendamentoId}` 
      : `${title}-${body}`;
    const lastAdded = notificationCacheRef.current.get(cacheKey);
    const now = Date.now();
    
    if (lastAdded && (now - lastAdded) < NOTIFICATION_DEBOUNCE_MS) {
      console.log('[NotificationBell] Notificação duplicada ignorada (cache):', cacheKey, 'última adição há', Math.round((now - lastAdded) / 1000), 'segundos');
      return;
    }
    
    // Atualizar cache
    notificationCacheRef.current.set(cacheKey, now);
    console.log('[NotificationBell] Adicionando nova notificação:', cacheKey, 'agendamentoId:', data?.agendamentoId);
    
    // Limpar cache antigo (manter apenas últimas 20 entradas)
    if (notificationCacheRef.current.size > 20) {
      const oldestKey = Array.from(notificationCacheRef.current.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
      notificationCacheRef.current.delete(oldestKey);
    }

    const newNotification: NotificationItem = {
      id: `${++notificationIdRef.current}`,
      title,
      body,
      timestamp: new Date(),
      data,
      read: false,
    };

    setNotifications((prev) => {
      // Verificar se já existe uma notificação com o mesmo agendamentoId
      if (data?.agendamentoId) {
        const exists = prev.some(n => n.data?.agendamentoId === data.agendamentoId);
        if (exists) {
          console.log('[NotificationBell] Notificação já existe para agendamento:', data.agendamentoId);
          return prev;
        }
      }
      
      const updated = [newNotification, ...prev];
      // Manter apenas últimas 50 notificações
      const limited = updated.slice(0, 50);
      saveNotifications(limited);
      return limited;
    });
  }, [isDoutor, saveNotifications]);

  // Escutar notificações do contexto
  useEffect(() => {
    if (!isDoutor) return;

    const handleCustomNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { title, body, data } = customEvent.detail;
      if (title && body) {
        addNotification(title, body, data);
      }
    };

    window.addEventListener('notification:created', handleCustomNotification);
    return () => {
      window.removeEventListener('notification:created', handleCustomNotification);
    };
  }, [isDoutor, addNotification]);

  // Expor função para adicionar notificação globalmente (para compatibilidade)
  useEffect(() => {
    if (!isDoutor) return;

    (window as any).__addNotification = addNotification;
    return () => {
      delete (window as any).__addNotification;
    };
  }, [isDoutor, addNotification]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    // Marcar como lida
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === notification.id ? { ...n, read: true } : n
      );
      saveNotifications(updated);
      return updated;
    });

    // Navegar se tiver URL
    if (notification.data?.url) {
      window.location.href = notification.data.url;
    }

    handleClose();
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  };

  const handleClearAll = () => {
    setNotifications([]);
    saveNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Não mostrar para não-doutores
  if (!isDoutor) {
    return null;
  }

  return (
    <>
      <Tooltip title="Notificações">
        <IconButton
          color="inherit"
          onClick={handleClick}
          sx={{
            mr: 1,
            position: 'relative',
          }}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            {unreadCount > 0 ? (
              <NotificationsIcon />
            ) : (
              <NotificationsNoneIcon />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 400,
            maxWidth: '90vw',
            maxHeight: '80vh',
            mt: 1,
          },
        }}
      >
        <Box>
          <Box
            sx={{
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6" fontWeight="bold">
              Notificações
            </Typography>
            <Stack direction="row" spacing={1}>
              {unreadCount > 0 && (
                <Button size="small" onClick={handleMarkAllAsRead}>
                  Marcar todas como lidas
                </Button>
              )}
              {notifications.length > 0 && (
                <IconButton size="small" onClick={handleClearAll}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </Box>

          {notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Nenhuma notificação
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 400, overflowY: 'auto', p: 0 }}>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    disablePadding
                    sx={{
                      backgroundColor: notification.read ? 'transparent' : 'action.selected',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemButton onClick={() => handleNotificationClick(notification)}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle2" fontWeight={notification.read ? 400 : 600}>
                              {notification.title}
                            </Typography>
                            {!notification.read && (
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: 'primary.main',
                                }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {notification.body}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatTimeAgo(notification.timestamp)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}

