import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Badge,
} from '@mui/material';
import { toast } from 'sonner';
import { getHandoffQueue, HandoffPaciente } from '../services/chat.service';

export const ChatPage: React.FC = () => {
  const [handoffQueue, setHandoffQueue] = useState<HandoffPaciente[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [selectedPaciente, setSelectedPaciente] = useState<HandoffPaciente | null>(null);

  const fetchHandoffQueue = async () => {
    try {
      setLoadingQueue(true);
      const queue = await getHandoffQueue();
      setHandoffQueue(queue);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar fila de atendimento.');
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchHandoffQueue();
  }, []);

  const handleSelectPaciente = (paciente: HandoffPaciente) => {
    setSelectedPaciente(paciente);
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 96px)', width: '100%' }}>
      <Paper
        sx={{
          width: '300px',
          flexShrink: 0,
          mr: 2,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        elevation={2}
      >
        <Typography variant="h6" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          Fila de Atendimento
          <Badge badgeContent={handoffQueue.length} color="error" sx={{ ml: 2 }} />
        </Typography>

        {loadingQueue ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {handoffQueue.length === 0 && (
              <ListItem>
                <ListItemText primary="Nenhum paciente em espera." />
              </ListItem>
            )}
            {handoffQueue.map((paciente) => (
              <ListItemButton
                key={paciente.id}
                selected={selectedPaciente?.id === paciente.id}
                onClick={() => handleSelectPaciente(paciente)}
              >
                <ListItemText primary={paciente.nome} secondary={paciente.telefone} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Paper>

      <Paper
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
        elevation={2}
      >
        {!selectedPaciente ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <Typography variant="h6" color="text.secondary">
              Selecione um paciente na fila para iniciar o atendimento.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, p: 2 }}>
            <Typography variant="h5">Conversa com: {selectedPaciente.nome}</Typography>
            <Typography variant="body1" color="text.secondary">
              (ID do Paciente: {selectedPaciente.id})
            </Typography>

            <Box sx={{ mt: 2, border: 1, borderColor: 'divider', height: '60vh', p: 1 }}>
              <Typography>(O histórico da conversa aparecerá aqui no próximo passo...)</Typography>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography>(A caixa de envio de mensagem aparecerá aqui...)</Typography>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};
