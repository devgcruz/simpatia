import React from 'react';
import { ListItem, ListItemAvatar, ListItemText, Avatar, Badge, Box, Typography } from '@mui/material';
import { Group as GroupIcon, Person as PersonIcon } from '@mui/icons-material';
import { ConversaInterna } from '../../services/chat-interno.service';

interface ChatListItemProps {
  conversa: ConversaInterna;
  isSelected: boolean;
  onClick: () => void;
  obterNomeConversa: (conversa: ConversaInterna) => string;
  isUsuarioOnline?: (usuarioId: number) => boolean;
  userId?: number;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({
  conversa,
  isSelected,
  onClick,
  obterNomeConversa,
  isUsuarioOnline,
  userId,
}) => {
  // Obter o outro participante (para conversas individuais)
  const outroParticipante = React.useMemo(() => {
    if (conversa.tipo === 'GRUPO' || !userId) {
      return null;
    }
    return conversa.participantes?.find((p) => p.usuarioId !== userId);
  }, [conversa, userId]);

  // Verificar se o outro participante está online (apenas para conversas individuais)
  const outroParticipanteOnline = React.useMemo(() => {
    if (conversa.tipo === 'GRUPO' || !isUsuarioOnline || !userId || !outroParticipante) {
      return false;
    }
    return isUsuarioOnline(outroParticipante.usuarioId);
  }, [conversa, isUsuarioOnline, userId, outroParticipante]);

  // Obter foto de perfil do outro participante (para conversas individuais)
  const fotoPerfil = React.useMemo(() => {
    if (conversa.tipo === 'GRUPO') {
      return null;
    }
    return outroParticipante?.usuario?.fotoPerfil || null;
  }, [conversa.tipo, outroParticipante]);

  // Obter inicial do nome para fallback
  const inicialNome = React.useMemo(() => {
    if (conversa.tipo === 'GRUPO') {
      return null;
    }
    const nome = outroParticipante?.usuario?.nome || '';
    return nome.charAt(0).toUpperCase();
  }, [conversa.tipo, outroParticipante]);
  const ultimaMensagem = conversa.mensagens && conversa.mensagens.length > 0 
    ? conversa.mensagens[0].conteudo 
    : 'Nenhuma mensagem';
  
  const ultimaMensagemData = conversa.mensagens && conversa.mensagens.length > 0
    ? new Date(conversa.mensagens[0].createdAt)
    : conversa.updatedAt
      ? new Date(conversa.updatedAt)
      : null;

  const formatarHora = (data: Date | string | null) => {
    if (!data) return '';
    const date = typeof data === 'string' ? new Date(data) : data;
    const agora = new Date();
    const diffMs = agora.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <ListItem
      button
      selected={isSelected}
      onClick={onClick}
      sx={{
        py: 1.5,
        px: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: isSelected ? 'action.selected' : 'transparent',
        '&:hover': {
          bgcolor: isSelected ? 'action.selected' : 'action.hover',
        },
        transition: 'background-color 0.2s',
        cursor: 'pointer',
      }}
    >
      <ListItemAvatar sx={{ minWidth: 56 }}>
        <Badge
          badgeContent={conversa.mensagensNaoLidas || 0}
          color="primary"
          invisible={!conversa.mensagensNaoLidas || conversa.mensagensNaoLidas === 0}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <Avatar
            src={fotoPerfil || undefined}
            sx={{
              width: 48,
              height: 48,
              bgcolor: conversa.tipo === 'GRUPO' ? 'secondary.main' : 'primary.main',
              ...(outroParticipanteOnline && {
                border: '1px solid',
                borderColor: 'rgba(63, 222, 68, 0.52)',
                boxShadow: '0 0 0 1px rgba(63, 222, 68, 0.52)',
              }),
            }}
          >
            {conversa.tipo === 'GRUPO' ? (
              <GroupIcon />
            ) : fotoPerfil ? null : (
              inicialNome || <PersonIcon />
            )}
          </Avatar>
        </Badge>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: conversa.mensagensNaoLidas && conversa.mensagensNaoLidas > 0 ? 600 : 400,
                fontSize: '0.9375rem',
                color: 'text.primary',
              }}
              noWrap
            >
              {obterNomeConversa(conversa)}
            </Typography>
            {ultimaMensagemData && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontSize: '0.75rem' }}>
                {formatarHora(ultimaMensagemData)}
              </Typography>
            )}
          </Box>
        }
        secondary={
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontSize: '0.8125rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {ultimaMensagem}
          </Typography>
        }
        sx={{ m: 0 }}
      />
    </ListItem>
  );
};

