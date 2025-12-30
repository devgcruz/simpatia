import React, { useRef, useEffect, useState } from 'react';
import { Box, TextField, IconButton, CircularProgress, Popover } from '@mui/material';
import { Send as SendIcon, EmojiEmotions as EmojiIcon } from '@mui/icons-material';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onFocus?: () => void;
  enviando: boolean;
  disabled: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onTypingStart,
  onTypingStop,
  onFocus,
  enviando,
  disabled,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previousEnviandoRef = useRef(enviando);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLButtonElement | null>(null);

  // Manter foco no input após enviar mensagem
  useEffect(() => {
    // Se estava enviando e agora não está mais, significa que a mensagem foi enviada
    if (previousEnviandoRef.current && !enviando) {
      // Pequeno delay para garantir que o estado foi atualizado
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
    previousEnviandoRef.current = enviando;
  }, [enviando]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    if (newValue.trim()) {
      onTypingStart();
    } else {
      onTypingStop();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !enviando && !disabled) {
        onSend();
      }
    }
  };

  const handleFocus = () => {
    if (onFocus) {
      onFocus();
    }
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
      const newValue = value.substring(0, start) + emoji + value.substring(end);
      onChange(newValue);
      
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
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
        }}
      >
        <IconButton
          onClick={handleEmojiClick}
          disabled={enviando || disabled}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'grey.100',
            },
          }}
        >
          <EmojiIcon />
        </IconButton>
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={4}
          placeholder="Digite sua mensagem..."
          value={value}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          onFocus={handleFocus}
          disabled={enviando || disabled}
          variant="outlined"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'grey.50',
              borderRadius: 2,
              '& fieldset': {
                borderColor: 'transparent',
              },
              '&:hover fieldset': {
                borderColor: 'transparent',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
            },
          }}
        />
        <IconButton
          color="primary"
          onClick={onSend}
          disabled={!value.trim() || enviando || disabled}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            width: 40,
            height: 40,
            '&:hover': {
              bgcolor: 'primary.dark',
            },
            '&:disabled': {
              bgcolor: 'grey.300',
              color: 'grey.500',
            },
          }}
        >
          {enviando ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
        </IconButton>
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
          theme="light"
          skinTonesDisabled
        />
      </Popover>
    </>
  );
};

