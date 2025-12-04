import React from 'react';
import { Box, IconButton, Avatar, Typography, Tooltip } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Group as GroupIcon, Person as PersonIcon } from '@mui/icons-material';
import { ConversaInterna } from '../../services/chat-interno.service';
import { useMediaQuery, useTheme } from '@mui/material';

interface ChatWindowHeaderProps {
  conversa: ConversaInterna;
  obterNomeConversa: (conversa: ConversaInterna) => string;
  usuariosDigitando: Set<number>;
  isUsuarioOnline: (usuarioId: number) => boolean;
  userId?: number;
  onVoltar?: () => void;
  onClose?: () => void;
}

export const ChatWindowHeader: React.FC<ChatWindowHeaderProps> = ({
  conversa,
  obterNomeConversa,
  usuariosDigitando,
  isUsuarioOnline,
  userId,
  onVoltar,
  onClose,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Determinar o status online para conversas individuais
  const getStatusText = () => {
    if (conversa.tipo === 'GRUPO') {
      return 'Grupo';
    }

    // Para conversas individuais, verificar se o outro participante está online
    if (conversa.participantes && conversa.participantes.length > 0) {
      const outroParticipante = conversa.participantes.find(
        (p) => p.usuarioId !== userId
      );
      
      if (outroParticipante) {
        const online = isUsuarioOnline(outroParticipante.usuarioId);
        return online ? 'Online' : 'Offline';
      }
    }

    return 'Offline';
  };

  return (
    <Box
      sx={{
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {isMobile && onVoltar && (
        <IconButton size="small" onClick={onVoltar} sx={{ mr: -1 }}>
          <ArrowBackIcon />
        </IconButton>
      )}
      <Avatar
        sx={{
          width: 40,
          height: 40,
          bgcolor: conversa.tipo === 'GRUPO' ? 'secondary.main' : 'primary.main',
        }}
      >
        {conversa.tipo === 'GRUPO' ? <GroupIcon /> : <PersonIcon />}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '1rem' }} noWrap>
          {obterNomeConversa(conversa)}
        </Typography>
        {usuariosDigitando.size > 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
            {Array.from(usuariosDigitando).length} digitando...
          </Typography>
        ) : (
          <Typography 
            variant="caption" 
            color={getStatusText() === 'Online' ? 'success.main' : 'text.secondary'} 
            sx={{ fontSize: '0.8125rem' }}
          >
            {getStatusText()}
          </Typography>
        )}
      </Box>
      {onClose && (
        <Tooltip title="Fechar chat">
          <IconButton size="small" onClick={onClose} color="default">
            <CloseIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

