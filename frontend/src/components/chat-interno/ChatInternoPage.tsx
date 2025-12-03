import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  TextField,
  IconButton,
  Typography,
  Badge,
  Divider,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Group as GroupIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import chatInternoService, {
  ConversaInterna,
  MensagemInterna,
} from '../../services/chat-interno.service';
import { useChatInternoWebSocket } from '../../hooks/useChatInternoWebSocket';
import { toast } from 'sonner';

export const ChatInternoPage: React.FC = () => {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<ConversaInterna[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<ConversaInterna | null>(null);
  const [mensagens, setMensagens] = useState<MensagemInterna[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const mensagensEndRef = useRef<HTMLDivElement>(null);
  const [usuariosDigitando, setUsuariosDigitando] = useState<Set<number>>(new Set());

  const { isConnected, enviarMensagem, marcarMensagensComoLidas, iniciarDigitando, pararDigitando } =
    useChatInternoWebSocket({
      conversaId: conversaSelecionada?.id || null,
      onNovaMensagem: (mensagem) => {
        if (mensagem.conversaId === conversaSelecionada?.id) {
          setMensagens((prev) => [...prev, mensagem]);
          marcarMensagensComoLidas(mensagem.conversaId);
        }
        // Atualizar lista de conversas
        carregarConversas();
      },
      onMensagensLidas: (data) => {
        // Atualizar status das mensagens
        setMensagens((prev) =>
          prev.map((msg) =>
            msg.conversaId === data.conversaId && msg.remetenteId !== data.usuarioId
              ? { ...msg, status: 'LIDA' as const }
              : msg
          )
        );
      },
      onDigitando: (data) => {
        if (data.conversaId === conversaSelecionada?.id) {
          setUsuariosDigitando((prev) => {
            const novo = new Set(prev);
            if (data.digitando) {
              novo.add(data.usuarioId);
            } else {
              novo.delete(data.usuarioId);
            }
            return novo;
          });
        }
      },
    });

  useEffect(() => {
    carregarConversas();
  }, []);

  useEffect(() => {
    if (conversaSelecionada) {
      carregarMensagens(conversaSelecionada.id);
      marcarMensagensComoLidas(conversaSelecionada.id);
    }
  }, [conversaSelecionada]);

  useEffect(() => {
    // Scroll para última mensagem
    mensagensEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const carregarConversas = async () => {
    try {
      setCarregando(true);
      const data = await chatInternoService.listConversas();
      setConversas(data);
    } catch (error: any) {
      toast.error('Erro ao carregar conversas');
      console.error(error);
    } finally {
      setCarregando(false);
    }
  };

  const carregarMensagens = async (conversaId: number) => {
    try {
      const data = await chatInternoService.getMensagens(conversaId);
      setMensagens(data.mensagens);
    } catch (error: any) {
      toast.error('Erro ao carregar mensagens');
      console.error(error);
    }
  };

  const handleEnviarMensagem = async () => {
    if (!conversaSelecionada || !novaMensagem.trim()) return;

    setEnviando(true);
    try {
      enviarMensagem({
        conversaId: conversaSelecionada.id,
        tipo: 'TEXTO',
        conteudo: novaMensagem.trim(),
      });
      setNovaMensagem('');
    } catch (error: any) {
      toast.error('Erro ao enviar mensagem');
      console.error(error);
    } finally {
      setEnviando(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviarMensagem();
    }
  };

  const obterNomeConversa = (conversa: ConversaInterna): string => {
    if (conversa.tipo === 'GRUPO') {
      return conversa.nome || 'Grupo sem nome';
    }
    // Para conversas individuais, mostrar o nome do outro participante
    const outroParticipante = conversa.participantes.find((p) => p.usuarioId !== user?.id);
    return outroParticipante?.usuario.nome || 'Conversa';
  };

  const obterAvatarConversa = (conversa: ConversaInterna): string => {
    if (conversa.tipo === 'GRUPO') {
      return conversa.nome?.[0]?.toUpperCase() || 'G';
    }
    const outroParticipante = conversa.participantes.find((p) => p.usuarioId !== user?.id);
    return outroParticipante?.usuario.nome?.[0]?.toUpperCase() || 'U';
  };

  const conversasFiltradas = termoBusca
    ? conversas.filter(
        (c) =>
          obterNomeConversa(c).toLowerCase().includes(termoBusca.toLowerCase()) ||
          c.descricao?.toLowerCase().includes(termoBusca.toLowerCase())
      )
    : conversas;

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Lista de conversas */}
      <Paper
        sx={{
          width: 350,
          display: 'flex',
          flexDirection: 'column',
          borderRight: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            Chat Interno
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar conversas..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {carregando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List sx={{ flex: 1, overflow: 'auto' }}>
            {conversasFiltradas.map((conversa) => (
              <ListItem
                key={conversa.id}
                button
                selected={conversaSelecionada?.id === conversa.id}
                onClick={() => setConversaSelecionada(conversa)}
              >
                <ListItemAvatar>
                  <Badge
                    badgeContent={conversa.mensagensNaoLidas || 0}
                    color="primary"
                    invisible={!conversa.mensagensNaoLidas || conversa.mensagensNaoLidas === 0}
                  >
                    <Avatar>
                      {conversa.tipo === 'GRUPO' ? (
                        <GroupIcon />
                      ) : (
                        <PersonIcon />
                      )}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={obterNomeConversa(conversa)}
                  secondary={
                    conversa.mensagens && conversa.mensagens.length > 0
                      ? conversa.mensagens[0].conteudo.substring(0, 50)
                      : 'Nenhuma mensagem'
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Área de mensagens */}
      {conversaSelecionada ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header da conversa */}
          <Paper sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar>
                {conversaSelecionada.tipo === 'GRUPO' ? <GroupIcon /> : <PersonIcon />}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">{obterNomeConversa(conversaSelecionada)}</Typography>
                {usuariosDigitando.size > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {Array.from(usuariosDigitando).length} usuário(s) digitando...
                  </Typography>
                )}
              </Box>
              {!isConnected && (
                <Typography variant="caption" color="error">
                  Desconectado
                </Typography>
              )}
            </Box>
          </Paper>

          {/* Mensagens */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'grey.50' }}>
            {mensagens.map((mensagem) => {
              const isMine = mensagem.remetenteId === user?.id;
              return (
                <Box
                  key={mensagem.id}
                  sx={{
                    display: 'flex',
                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                    mb: 1,
                  }}
                >
                  <Paper
                    sx={{
                      p: 1.5,
                      maxWidth: '70%',
                      bgcolor: isMine ? 'primary.main' : 'white',
                      color: isMine ? 'white' : 'text.primary',
                    }}
                  >
                    {!isMine && (
                      <Typography variant="caption" display="block" gutterBottom>
                        {mensagem.remetente.nome}
                      </Typography>
                    )}
                    <Typography variant="body1">{mensagem.conteudo}</Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 0.5, opacity: 0.7 }}>
                      {new Date(mensagem.createdAt).toLocaleTimeString()}
                      {mensagem.status === 'LIDA' && isMine && ' ✓✓'}
                    </Typography>
                  </Paper>
                </Box>
              );
            })}
            <div ref={mensagensEndRef} />
          </Box>

          {/* Input de mensagem */}
          <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="Digite sua mensagem..."
                value={novaMensagem}
                onChange={(e) => {
                  setNovaMensagem(e.target.value);
                  if (e.target.value && conversaSelecionada) {
                    iniciarDigitando(conversaSelecionada.id);
                  } else if (conversaSelecionada) {
                    pararDigitando(conversaSelecionada.id);
                  }
                }}
                onKeyPress={handleKeyPress}
                disabled={enviando || !isConnected}
              />
              <IconButton
                color="primary"
                onClick={handleEnviarMensagem}
                disabled={!novaMensagem.trim() || enviando || !isConnected}
              >
                {enviando ? <CircularProgress size={24} /> : <SendIcon />}
              </IconButton>
            </Box>
          </Paper>
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.50',
          }}
        >
          <Typography variant="h6" color="text.secondary">
            Selecione uma conversa para começar
          </Typography>
        </Box>
      )}
    </Box>
  );
};

