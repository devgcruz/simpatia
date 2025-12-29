import React, { useState } from 'react';
import { Box, TextField, IconButton, CircularProgress, Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useChatEncryption } from '../../hooks/useChatEncryption';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  onCloseChat: () => Promise<void>;
  isSending: boolean;
  isClosing: boolean;
  pacienteId: number | null; // ID do paciente para criptografia E2E
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onCloseChat,
  isSending,
  isClosing,
  pacienteId,
}) => {
  const [message, setMessage] = useState('');
  const { encryptMessage, isInitialized } = useChatEncryption();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!message.trim() || isSending || isClosing) {
      return;
    }

    try {
      let contentToSend = message.trim();

      // Criptografar mensagem se E2E estiver inicializado e houver pacienteId
      if (isInitialized && pacienteId) {
        try {
          contentToSend = await encryptMessage(message.trim(), pacienteId);
          console.log('[E2E] Mensagem criptografada antes de enviar');
        } catch (error) {
          console.error('[E2E] Erro ao criptografar, enviando sem criptografia:', error);
          // Continuar com mensagem original em caso de erro
        }
      }

      await onSendMessage(contentToSend);
      setMessage('');
    } catch (error) {
      console.error('[ChatInput] Erro ao enviar mensagem:', error);
    }
  };

  const handleClose = async () => {
    if (isSending || isClosing) {
      return;
    }
    await onCloseChat();
  };

  return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
      >
        <TextField
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Digite a sua mensagem..."
          fullWidth
          size="small"
          variant="outlined"
          disabled={isSending || isClosing}
        />
        <IconButton
          type="submit"
          color="primary"
          disabled={!message.trim() || isSending || isClosing}
          size="large"
          sx={{ borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}
        >
          {isSending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
        </IconButton>
      </Box>
      <Button
        variant="outlined"
        color="success"
        size="small"
        fullWidth
        onClick={handleClose}
        disabled={isClosing || isSending}
        sx={{ mt: 1 }}
      >
        {isClosing ? 'A fechar...' : 'Fechar Atendimento (Devolver ao BOT)'}
      </Button>
    </Box>
  );
};


