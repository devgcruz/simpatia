import React from 'react';
import { Box, TextField, IconButton, CircularProgress } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  enviando: boolean;
  disabled: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onTypingStart,
  onTypingStop,
  enviando,
  disabled,
}) => {
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

  return (
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
      <TextField
        fullWidth
        multiline
        maxRows={4}
        placeholder="Digite sua mensagem..."
        value={value}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
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
  );
};

