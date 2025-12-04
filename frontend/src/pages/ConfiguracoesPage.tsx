import React, { useState } from 'react';
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
  ListItemButton,
  ListItemText,
  ListItemIcon,
  RadioGroup,
  Radio,
  IconButton,
  Collapse,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useSettings, NotificationSoundType } from '../context/SettingsContext';
import { playNotificationSound } from '../utils/notificationSound';

export const ConfiguracoesPage: React.FC = () => {
  const { settings, toggleSound, toggleBrowserNotifications, setSoundType, setAppointmentSoundType } = useSettings();
  const [chatSoundExpanded, setChatSoundExpanded] = useState(false);
  const [appointmentSoundExpanded, setAppointmentSoundExpanded] = useState(false);

  const soundTypes: { value: NotificationSoundType; label: string; description: string }[] = [
    { value: 'default', label: 'Padrão', description: 'Tom equilibrado e suave' },
    { value: 'soft', label: 'Suave', description: 'Tom mais baixo e discreto' },
    { value: 'chime', label: 'Sino', description: 'Tom musical harmonioso' },
    { value: 'bell', label: 'Sino Alto', description: 'Tom claro e alto' },
    { value: 'pop', label: 'Pop', description: 'Som curto e rápido' },
    { value: 'ding', label: 'Ding', description: 'Tom agudo e curto' },
  ];

  const appointmentSoundTypes: { value: NotificationSoundType; label: string; description: string }[] = [
    { value: 'appointment1', label: 'Agendamento 1', description: 'Tom ascendente e alegre' },
    { value: 'appointment2', label: 'Agendamento 2', description: 'Tom grave e profissional' },
    { value: 'appointment3', label: 'Agendamento 3', description: 'Tom médio e claro' },
    ...soundTypes, // Incluir também os sons gerais
  ];

  const handlePlaySound = (soundType: NotificationSoundType) => {
    playNotificationSound(soundType);
  };

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

          {settings.notifications.soundEnabled && (
            <>
              <ListItem
                disablePadding
                sx={{
                  px: 0,
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                }}
              >
                <ListItemButton
                  onClick={() => setChatSoundExpanded(!chatSoundExpanded)}
                  sx={{ px: 2, py: 1.5 }}
                >
                  <ListItemText
                    primary="Tom de Notificação - Chat"
                    primaryTypographyProps={{ fontWeight: 500, variant: 'body2' }}
                  />
                  {chatSoundExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItemButton>
                <Collapse in={chatSoundExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ px: 2, pb: 2 }}>
                    <RadioGroup
                      value={settings.notifications.soundType}
                      onChange={(e) => setSoundType(e.target.value as NotificationSoundType)}
                      sx={{ gap: 0.5 }}
                    >
                      {soundTypes.map((sound) => (
                        <Box
                          key={sound.value}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1,
                            borderRadius: 1,
                            '&:hover': {
                              bgcolor: 'action.hover',
                            },
                          }}
                        >
                          <FormControlLabel
                            value={sound.value}
                            control={<Radio size="small" />}
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {sound.label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {sound.description}
                                </Typography>
                              </Box>
                            }
                            sx={{ flex: 1, m: 0 }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => handlePlaySound(sound.value)}
                            sx={{ ml: 1 }}
                            color="primary"
                          >
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </RadioGroup>
                  </Box>
                </Collapse>
              </ListItem>
              <ListItem
                disablePadding
                sx={{
                  px: 0,
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                }}
              >
                <ListItemButton
                  onClick={() => setAppointmentSoundExpanded(!appointmentSoundExpanded)}
                  sx={{ px: 2, py: 1.5 }}
                >
                  <ListItemText
                    primary="Tom de Notificação - Agendamentos"
                    primaryTypographyProps={{ fontWeight: 500, variant: 'body2' }}
                  />
                  {appointmentSoundExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItemButton>
                <Collapse in={appointmentSoundExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ px: 2, pb: 2 }}>
                    <RadioGroup
                      value={settings.notifications.appointmentSoundType}
                      onChange={(e) => setAppointmentSoundType(e.target.value as NotificationSoundType)}
                      sx={{ gap: 0.5 }}
                    >
                      {appointmentSoundTypes.map((sound) => (
                        <Box
                          key={sound.value}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1,
                            borderRadius: 1,
                            '&:hover': {
                              bgcolor: 'action.hover',
                            },
                          }}
                        >
                          <FormControlLabel
                            value={sound.value}
                            control={<Radio size="small" />}
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {sound.label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {sound.description}
                                </Typography>
                              </Box>
                            }
                            sx={{ flex: 1, m: 0 }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => handlePlaySound(sound.value)}
                            sx={{ ml: 1 }}
                            color="primary"
                          >
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </RadioGroup>
                  </Box>
                </Collapse>
              </ListItem>
            </>
          )}

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

