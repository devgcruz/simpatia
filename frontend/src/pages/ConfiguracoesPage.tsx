import React from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import { useSettings } from '../context/SettingsContext';

export const ConfiguracoesPage: React.FC = () => {
  const { settings, toggleSound, toggleBrowserNotifications } = useSettings();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <SettingsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Configurações
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Gerencie suas preferências e configurações do sistema
        </Typography>
      </Box>

      <Paper elevation={2} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <NotificationsIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" component="h2" sx={{ fontWeight: 500 }}>
            Notificações
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <List>
          <ListItem
            sx={{
              px: 0,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <ListItemIcon sx={{ minWidth: 48 }}>
              {settings.notifications.soundEnabled ? (
                <VolumeUpIcon sx={{ color: 'primary.main' }} />
              ) : (
                <VolumeOffIcon sx={{ color: 'text.disabled' }} />
              )}
            </ListItemIcon>
            <ListItemText
              primary="Som de Notificação"
              secondary="Reproduzir som quando receber notificações"
              primaryTypographyProps={{ fontWeight: 500 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications.soundEnabled}
                  onChange={toggleSound}
                  color="primary"
                />
              }
              label=""
            />
          </ListItem>

          <ListItem
            sx={{
              px: 0,
              py: 2,
            }}
          >
            <ListItemIcon sx={{ minWidth: 48 }}>
              {settings.notifications.browserNotificationsEnabled ? (
                <NotificationsActiveIcon sx={{ color: 'primary.main' }} />
              ) : (
                <NotificationsOffIcon sx={{ color: 'text.disabled' }} />
              )}
            </ListItemIcon>
            <ListItemText
              primary="Notificações do Navegador"
              secondary="Exibir notificações do navegador quando receber atualizações"
              primaryTypographyProps={{ fontWeight: 500 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications.browserNotificationsEnabled}
                  onChange={toggleBrowserNotifications}
                  color="primary"
                />
              }
              label=""
            />
          </ListItem>
        </List>
      </Paper>
    </Container>
  );
};

