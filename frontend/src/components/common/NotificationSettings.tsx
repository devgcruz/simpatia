import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNotificationContext } from '../../context/NotificationContext';
import { toast } from 'sonner';

export function NotificationSettings() {
  const { isSupported, permission, requestPermission } = useNotificationContext();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        toast.success('Notificações habilitadas com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      toast.error('Erro ao solicitar permissão de notificações.');
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">
            Seu navegador não suporta notificações. Por favor, use Chrome ou Edge.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return {
          icon: <CheckCircleIcon color="success" />,
          text: 'Notificações habilitadas',
          color: 'success' as const,
        };
      case 'denied':
        return {
          icon: <CancelIcon color="error" />,
          text: 'Notificações negadas',
          color: 'error' as const,
        };
      default:
        return {
          icon: <NotificationsOffIcon color="warning" />,
          text: 'Permissão não solicitada',
          color: 'warning' as const,
        };
    }
  };

  const status = getPermissionStatus();

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <NotificationsIcon color="primary" />
            <Typography variant="h6">Notificações</Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            {status.icon}
            <Typography color={status.color.main}>{status.text}</Typography>
          </Box>

          {permission === 'denied' && (
            <Alert severity="error">
              As notificações foram negadas. Para habilitar, acesse as configurações do navegador
              e permita notificações para este site.
            </Alert>
          )}

          {permission === 'default' && (
            <Alert severity="info">
              Habilite as notificações para receber avisos em tempo real sobre novos agendamentos.
            </Alert>
          )}

          {permission !== 'granted' && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleRequestPermission}
              disabled={isRequesting}
              startIcon={<NotificationsIcon />}
            >
              {isRequesting ? 'Solicitando...' : 'Habilitar Notificações'}
            </Button>
          )}

          {permission === 'granted' && (
            <Alert severity="success">
              Você receberá notificações quando novos agendamentos forem criados.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

