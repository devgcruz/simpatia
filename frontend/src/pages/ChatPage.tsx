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
import {
  closeHandoffChat,
  getHandoffQueue,
  HandoffPaciente,
  IChatMessage,
  sendDoutorMessage,
} from '../services/chat.service';
import { ChatHistory } from '../components/chat/ChatHistory';
import { ChatInput } from '../components/chat/ChatInput';
import { useAuth } from '../hooks/useAuth';
import { useDoutorSelecionado } from '../context/DoutorSelecionadoContext';

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const { doutorSelecionado, isLoading: isLoadingDoutor } = useDoutorSelecionado();
  const [handoffQueue, setHandoffQueue] = useState<HandoffPaciente[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [selectedPaciente, setSelectedPaciente] = useState<HandoffPaciente | null>(null);
  const [newMessages, setNewMessages] = useState<IChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const isSecretaria = user?.role === 'SECRETARIA';

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
  }, [doutorSelecionado]); // Recarregar quando o doutor selecionado mudar

  const handleSelectPaciente = (paciente: HandoffPaciente) => {
    setSelectedPaciente(paciente);
    setNewMessages([]);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedPaciente) {
      return;
    }

    try {
      setIsSending(true);
      const sentMessage = await sendDoutorMessage(selectedPaciente.id, content);
      setNewMessages((prev) => [...prev, sentMessage]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao enviar mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseChat = async () => {
    if (!selectedPaciente) {
      return;
    }

    try {
      setIsClosing(true);
      await closeHandoffChat(selectedPaciente.id);
      toast.success(`Atendimento de ${selectedPaciente.nome} fechado. O BOT assumirá.`);
      setHandoffQueue((prev) => prev.filter((paciente) => paciente.id !== selectedPaciente.id));
      setSelectedPaciente(null);
      setNewMessages([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao fechar o chat.');
    } finally {
      setIsClosing(false);
    }
  };

  // Se for SECRETARIA e ainda estiver carregando o contexto, mostrar loading
  if (isSecretaria && isLoadingDoutor) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 96px)' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Se for SECRETARIA e não houver doutor selecionado, mostrar mensagem
  if (isSecretaria && !doutorSelecionado) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 96px)' }}>
        <Typography variant="h6" color="text.secondary">
          Selecione um doutor no menu lateral para visualizar os atendimentos.
        </Typography>
      </Box>
    );
  }

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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="h6" color="text.secondary">
              Selecione um paciente na fila para iniciar o atendimento.
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h5">{selectedPaciente.nome}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedPaciente.telefone}
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
              <ChatHistory pacienteId={selectedPaciente.id} newMessages={newMessages} />
            </Box>
            <ChatInput
              onSendMessage={handleSendMessage}
              onCloseChat={handleCloseChat}
              isSending={isSending}
              isClosing={isClosing}
              pacienteId={selectedPaciente.id}
            />
          </>
        )}
      </Paper>
    </Box>
  );
};
