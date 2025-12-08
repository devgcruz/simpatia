import React from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  List,
  CircularProgress,
  Typography,
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon } from '@mui/icons-material';
import { ChatListItem } from './ChatListItem';
import { ConversaInterna } from '../../services/chat-interno.service';

interface ChatListProps {
  conversas: ConversaInterna[];
  conversaSelecionada: ConversaInterna | null;
  termoBusca: string;
  onTermoBuscaChange: (termo: string) => void;
  onConversaClick: (conversa: ConversaInterna) => void;
  onNovaConversaClick: () => void;
  carregando: boolean;
  obterNomeConversa: (conversa: ConversaInterna) => string;
  user: any;
  isUsuarioOnline?: (usuarioId: number) => boolean;
}

export const ChatList: React.FC<ChatListProps> = ({
  conversas,
  conversaSelecionada,
  termoBusca,
  onTermoBuscaChange,
  onConversaClick,
  onNovaConversaClick,
  carregando,
  obterNomeConversa,
  user,
  isUsuarioOnline,
}) => {
  const conversasFiltradas = termoBusca
    ? conversas.filter(
      (c) =>
        obterNomeConversa(c).toLowerCase().includes(termoBusca.toLowerCase()) ||
        c.descricao?.toLowerCase().includes(termoBusca.toLowerCase())
    )
    : conversas;

  const conversasValidas = conversasFiltradas.filter((conversa) => {
    if (!conversa.participantes || conversa.participantes.length === 0) {
      return false;
    }
    if (conversa.tipo === 'INDIVIDUAL') {
      const outroParticipante = conversa.participantes.find((p) => p.usuarioId !== user?.id);
      return outroParticipante && outroParticipante.usuario && outroParticipante.usuario.nome;
    }
    return true;
  });

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Header com busca */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar conversas..."
            value={termoBusca}
            onChange={(e) => onTermoBuscaChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              sx: {
                bgcolor: 'grey.100',
                borderRadius: 2,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'transparent',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'transparent',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={onNovaConversaClick}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            <AddIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Lista de conversas */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {carregando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={32} />
          </Box>
        ) : conversasValidas.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {termoBusca ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
            </Typography>
            {!termoBusca && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Clique no botão + para iniciar uma conversa
              </Typography>
            )}
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {conversasValidas.map((conversa) => (
              <ChatListItem
                key={conversa.id}
                conversa={conversa}
                isSelected={conversaSelecionada?.id === conversa.id}
                onClick={() => onConversaClick(conversa)}
                obterNomeConversa={obterNomeConversa}
                isUsuarioOnline={isUsuarioOnline}
                userId={user?.id}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

