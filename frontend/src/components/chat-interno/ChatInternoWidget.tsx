import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Badge,
  TextField,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Slide,
  Fade,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Send as SendIcon,
  Search as SearchIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  RadioButtonChecked as OnlineIcon,
  RadioButtonUnchecked as OfflineIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import chatInternoService, {
  ConversaInterna,
  MensagemInterna,
  UsuarioOnline,
} from '../../services/chat-interno.service';
import { useChatInternoWebSocket } from '../../hooks/useChatInternoWebSocket';
import { toast } from 'sonner';

export const ChatInternoWidget: React.FC = () => {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [conversas, setConversas] = useState<ConversaInterna[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<ConversaInterna | null>(null);
  const [mensagens, setMensagens] = useState<MensagemInterna[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [mostrarLista, setMostrarLista] = useState(true);
  const [mostrarNovoChat, setMostrarNovoChat] = useState(false);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<any[]>([]);
  const [usuariosOnline, setUsuariosOnline] = useState<UsuarioOnline[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const mensagensEndRef = useRef<HTMLDivElement>(null);
  const [usuariosDigitando, setUsuariosDigitando] = useState<Set<number>>(new Set());

  const { isConnected, enviarMensagem, marcarMensagensComoLidas, iniciarDigitando, pararDigitando } =
    useChatInternoWebSocket({
      conversaId: conversaSelecionada?.id || null,
      enabled: aberto, // Só conectar quando o widget estiver aberto
      onNovaMensagem: (mensagem) => {
        if (mensagem.conversaId === conversaSelecionada?.id) {
          setMensagens((prev) => [...prev, mensagem]);
          marcarMensagensComoLidas(mensagem.conversaId);
        }
        carregarConversas();
      },
      onMensagensLidas: (data) => {
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
    if (aberto) {
      carregarConversas();
      carregarUsuariosDisponiveis();
      carregarUsuariosOnline();
    }
  }, [aberto]);

  const carregarUsuariosDisponiveis = async () => {
    try {
      setCarregandoUsuarios(true);
      const usuarios = await chatInternoService.getUsuariosDisponiveis();
      setUsuariosDisponiveis(usuarios);
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários disponíveis');
    } finally {
      setCarregandoUsuarios(false);
    }
  };

  const carregarUsuariosOnline = async () => {
    try {
      const usuarios = await chatInternoService.getUsuariosOnline();
      setUsuariosOnline(usuarios);
    } catch (error: any) {
      console.error('Erro ao carregar usuários online:', error);
    }
  };

  const handleIniciarConversa = async (usuarioId: number) => {
    try {
      const conversa = await chatInternoService.createConversaIndividual(usuarioId);
      setConversaSelecionada(conversa);
      setMostrarNovoChat(false);
      setMostrarLista(false);
      await carregarConversas();
    } catch (error: any) {
      toast.error('Erro ao iniciar conversa');
      console.error(error);
    }
  };

  const isUsuarioOnline = (usuarioId: number): boolean => {
    return usuariosOnline.some((u) => u.usuario.id === usuarioId && u.online);
  };

  useEffect(() => {
    if (conversaSelecionada && aberto) {
      carregarMensagens(conversaSelecionada.id);
      marcarMensagensComoLidas(conversaSelecionada.id);
    }
  }, [conversaSelecionada, aberto]);

  useEffect(() => {
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

  const totalMensagensNaoLidas = conversas.reduce((total, conv) => total + (conv.mensagensNaoLidas || 0), 0);

  const conversasFiltradas = termoBusca
    ? conversas.filter(
        (c) =>
          obterNomeConversa(c).toLowerCase().includes(termoBusca.toLowerCase()) ||
          c.descricao?.toLowerCase().includes(termoBusca.toLowerCase())
      )
    : conversas;

  return (
    <>
      {/* Botão flutuante do chat */}
      <Tooltip title="Chat Interno">
        <IconButton
          onClick={() => setAberto(!aberto)}
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            width: 56,
            height: 56,
            bgcolor: 'primary.main',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1300,
            transition: 'all 0.3s ease',
            '&:hover': {
              bgcolor: 'primary.dark',
              boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
              transform: 'scale(1.05)',
            },
          }}
        >
          <Badge badgeContent={totalMensagensNaoLidas} color="error">
            <ChatIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Widget do chat */}
      <Slide direction="up" in={aberto} mountOnEnter unmountOnExit>
        <Paper
          sx={{
            position: 'fixed',
            bottom: 90,
            right: 20,
            width: { xs: 'calc(100vw - 40px)', sm: 380 },
            maxWidth: 380,
            height: 600,
            maxHeight: 'calc(100vh - 120px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 1300,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Chat Interno
            </Typography>
            <Box>
              {!isConnected && (
                <Typography variant="caption" sx={{ mr: 1, opacity: 0.8 }}>
                  Desconectado
                </Typography>
              )}
              {!mostrarLista && (
                <IconButton
                  size="small"
                  onClick={() => setMostrarLista(true)}
                  sx={{ color: 'white', mr: 1 }}
                >
                  <ArrowBackIcon />
                </IconButton>
              )}
              <IconButton size="small" onClick={() => setAberto(false)} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Lista de conversas */}
            {mostrarLista && (
              <Box
                sx={{
                  width: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  borderRight: 1,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Buscar..."
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
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => setMostrarNovoChat(!mostrarNovoChat)}
                      title="Nova conversa"
                    >
                      <AddIcon />
                    </IconButton>
                  </Box>
                </Box>

                {mostrarNovoChat ? (
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Iniciar conversa
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Selecione um usuário para iniciar uma conversa
                      </Typography>
                    </Box>
                    {carregandoUsuarios ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : (
                      <List sx={{ p: 0 }}>
                        {usuariosDisponiveis.map((usuario) => (
                          <ListItem
                            key={usuario.id}
                            button
                            onClick={() => handleIniciarConversa(usuario.id)}
                            sx={{ py: 1 }}
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ width: 32, height: 32 }}>
                                {usuario.nome?.[0]?.toUpperCase() || 'U'}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {usuario.nome}
                                  {isUsuarioOnline(usuario.id) ? (
                                    <OnlineIcon sx={{ fontSize: 12, color: 'success.main' }} />
                                  ) : (
                                    <OfflineIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                  )}
                                </Box>
                              }
                              secondary={usuario.email}
                              primaryTypographyProps={{ fontSize: '0.875rem' }}
                              secondaryTypographyProps={{ fontSize: '0.75rem' }}
                            />
                          </ListItem>
                        ))}
                        {usuariosDisponiveis.length === 0 && (
                          <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Nenhum usuário disponível
                            </Typography>
                          </Box>
                        )}
                      </List>
                    )}
                  </Box>
                ) : (
                  <>
                    {carregando ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : conversasFiltradas.length === 0 ? (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Nenhuma conversa ainda
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                          Clique no botão + para iniciar uma conversa
                        </Typography>
                        <IconButton
                          color="primary"
                          onClick={() => setMostrarNovoChat(true)}
                          sx={{ mt: 1 }}
                        >
                          <AddIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                        {conversasFiltradas.map((conversa) => (
                      <ListItem
                        key={conversa.id}
                        button
                        selected={conversaSelecionada?.id === conversa.id}
                        onClick={() => {
                          setConversaSelecionada(conversa);
                          setMostrarLista(false);
                        }}
                        sx={{ py: 1 }}
                      >
                        <ListItemAvatar>
                          <Badge
                            badgeContent={conversa.mensagensNaoLidas || 0}
                            color="primary"
                            invisible={!conversa.mensagensNaoLidas || conversa.mensagensNaoLidas === 0}
                          >
                            <Avatar sx={{ width: 32, height: 32 }}>
                              {conversa.tipo === 'GRUPO' ? <GroupIcon /> : <PersonIcon />}
                            </Avatar>
                          </Badge>
                        </ListItemAvatar>
                        <ListItemText
                          primary={obterNomeConversa(conversa)}
                          primaryTypographyProps={{ fontSize: '0.875rem' }}
                          secondary={
                            conversa.mensagens && conversa.mensagens.length > 0
                              ? conversa.mensagens[0].conteudo.substring(0, 30)
                              : 'Nenhuma mensagem'
                          }
                          secondaryTypographyProps={{ fontSize: '0.75rem' }}
                        />
                      </ListItem>
                        ))}
                      </List>
                    )}
                  </>
                )}
              </Box>
            )}

            {/* Área de mensagens */}
            {conversaSelecionada ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Header da conversa */}
                <Box
                  sx={{
                    p: 1.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Avatar sx={{ width: 32, height: 32 }}>
                    {conversaSelecionada.tipo === 'GRUPO' ? <GroupIcon /> : <PersonIcon />}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                      {obterNomeConversa(conversaSelecionada)}
                    </Typography>
                    {usuariosDigitando.size > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {Array.from(usuariosDigitando).length} digitando...
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Mensagens */}
                <Box
                  sx={{
                    flex: 1,
                    overflow: 'auto',
                    p: 1.5,
                    bgcolor: 'grey.50',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  {mensagens.map((mensagem) => {
                    const isMine = mensagem.remetenteId === user?.id;
                    return (
                      <Box
                        key={mensagem.id}
                        sx={{
                          display: 'flex',
                          justifyContent: isMine ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <Paper
                          sx={{
                            p: 1,
                            maxWidth: '75%',
                            bgcolor: isMine ? 'primary.main' : 'white',
                            color: isMine ? 'white' : 'text.primary',
                          }}
                        >
                          {!isMine && (
                            <Typography variant="caption" display="block" gutterBottom>
                              {mensagem.remetente.nome}
                            </Typography>
                          )}
                          <Typography variant="body2">{mensagem.conteudo}</Typography>
                          <Typography
                            variant="caption"
                            display="block"
                            sx={{ mt: 0.5, opacity: 0.7, fontSize: '0.7rem' }}
                          >
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
                <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    maxRows={3}
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
                    sx={{ alignSelf: 'flex-end' }}
                  >
                    {enviando ? <CircularProgress size={20} /> : <SendIcon />}
                  </IconButton>
                </Box>
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
                <Typography variant="body2" color="text.secondary" align="center">
                  {mostrarLista ? 'Selecione uma conversa' : 'Nenhuma conversa selecionada'}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Slide>
    </>
  );
};

