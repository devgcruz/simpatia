import React, { useState, useRef } from 'react';
import { Box, TextField, IconButton, CircularProgress, Button, Popover } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  onCloseChat: () => Promise<void>;
  isSending: boolean;
  isClosing: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onCloseChat,
  isSending,
  isClosing,
}) => {
  const [message, setMessage] = useState('');
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!message.trim() || isSending || isClosing) {
      return;
    }

    try {
      // O servidor criptografa automaticamente (Server-Side Encryption)
      await onSendMessage(message.trim());
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

  const handleEmojiClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setEmojiAnchorEl(event.currentTarget);
  };

  const handleEmojiClose = () => {
    setEmojiAnchorEl(null);
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newValue = message.substring(0, start) + emoji + message.substring(end);
      setMessage(newValue);
      
      // Restaurar foco e posição do cursor
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
    handleEmojiClose();
  };

  return (
    <>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
        >
          <IconButton
            onClick={handleEmojiClick}
            disabled={isSending || isClosing}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'grey.100',
              },
            }}
          >
            <EmojiEmotionsIcon />
          </IconButton>
          <TextField
            inputRef={inputRef}
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
      <Popover
        open={Boolean(emojiAnchorEl)}
        anchorEl={emojiAnchorEl}
        onClose={handleEmojiClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <EmojiPicker
          onEmojiClick={onEmojiClick}
          autoFocusSearch={false}
          skinTonesDisabled
        />
      </Popover>
    </>
  );
};


