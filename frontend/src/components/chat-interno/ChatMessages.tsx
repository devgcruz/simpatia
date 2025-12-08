import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography, Avatar } from '@mui/material';
import { MensagemInterna } from '../../services/chat-interno.service';

interface ChatMessagesProps {
  mensagens: MensagemInterna[];
  userId: number | undefined;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ mensagens, userId }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const formatarHora = (data: string) => {
    const date = new Date(data);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        p: 2,
        bgcolor: 'grey.50',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(0,0,0,0.3)',
        },
      }}
    >
      {mensagens.map((mensagem) => {
        const isMine = mensagem.remetenteId === userId;
        return (
          <Box
            key={mensagem.id}
            sx={{
              display: 'flex',
              justifyContent: isMine ? 'flex-end' : 'flex-start',
              alignItems: 'flex-end',
              gap: 1,
            }}
          >
            {!isMine && (
              <Avatar
                src={mensagem.remetente.fotoPerfil || undefined}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.main',
                  fontSize: '0.875rem',
                }}
              >
                {mensagem.remetente.fotoPerfil ? null : mensagem.remetente.nome.charAt(0).toUpperCase()}
              </Avatar>
            )}
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                maxWidth: '70%',
                bgcolor: isMine ? 'primary.main' : 'white',
                color: isMine ? 'white' : 'text.primary',
                borderRadius: 2,
                borderTopLeftRadius: isMine ? 2 : 0.5,
                borderTopRightRadius: isMine ? 0.5 : 2,
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            >
              {!isMine && (
                <Typography
                  variant="caption"
                  display="block"
                  gutterBottom
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    opacity: 0.9,
                    mb: 0.5,
                  }}
                >
                  {mensagem.remetente.nome}
                </Typography>
              )}
              <Typography variant="body2" sx={{ fontSize: '0.9375rem', wordBreak: 'break-word' }}>
                {mensagem.conteudo}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.6875rem',
                    opacity: 0.7,
                  }}
                >
                  {formatarHora(mensagem.createdAt)}
                </Typography>
                {isMine && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.75rem',
                      opacity: mensagem.status === 'LIDA' ? 1 : mensagem.status === 'ENTREGUE' ? 0.7 : 0.5,
                      ml: 0.5,
                      color: mensagem.status === 'LIDA' ? 'inherit' : 'inherit',
                    }}
                    title={
                      mensagem.status === 'LIDA'
                        ? 'Visualizada'
                        : mensagem.status === 'ENTREGUE'
                        ? 'Entregue'
                        : 'Enviada'
                    }
                  >
                    {mensagem.status === 'LIDA' ? '✓✓' : mensagem.status === 'ENTREGUE' ? '✓' : '⏱'}
                  </Typography>
                )}
              </Box>
            </Paper>
            {isMine && (
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}>
                {formatarHora(mensagem.createdAt)}
              </Typography>
            )}
          </Box>
        );
      })}
      <div ref={messagesEndRef} />
    </Box>
  );
};

