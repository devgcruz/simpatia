import React, { useState } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Badge,
  CircularProgress,
  Tooltip,
  Slide,
  useMediaQuery,
  useTheme,
  Avatar,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useChatWidget } from '../../hooks/useChatWidget';
import { ChatList } from './ChatList';
import { ChatWindowHeader } from './ChatWindowHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

export const ChatInternoWidget: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Use the new hook for all logic
  const {
    aberto,
    setAberto,
    conversas,
    conversaSelecionada,
    setConversaSelecionada,
    mensagens,
    carregando,
    usuariosDisponiveis,
    usuariosOnline,
    carregandoUsuarios,
    usuariosDigitando,
    totalMensagensNaoLidas,
    isConnected,
    user,
    selecionarConversa,
    enviarMensagem,
    iniciarConversa,
    iniciarDigitando,
    pararDigitando,
    obterNomeConversa,
    zerarMensagensNaoLidasAoFocarInput,
  } = useChatWidget();

  console.log('[ChatInternoWidget] Render. totalMensagensNaoLidas:', totalMensagensNaoLidas);

  // Local UI state
  const [termoBusca, setTermoBusca] = useState('');
  const [mostrarNovoChat, setMostrarNovoChat] = useState(false);
  const [mostrarListaMobile, setMostrarListaMobile] = useState(true);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Handlers
  const handleConversaClick = (conversa: any) => {
    selecionarConversa(conversa);
    if (isMobile) setMostrarListaMobile(false);
  };

  const handleIniciarConversa = async (usuarioId: number) => {
    const sucesso = await iniciarConversa(usuarioId);
    if (sucesso) {
      setMostrarNovoChat(false);
      if (isMobile) setMostrarListaMobile(false);
    }
  };

  const handleEnviarMensagem = async () => {
    if (!novaMensagem.trim()) return;
    setEnviando(true);
    await enviarMensagem(novaMensagem.trim());
    setNovaMensagem('');
    setEnviando(false);
  };

  const handleVoltar = () => {
    if (isMobile) setMostrarListaMobile(true);
  };

  const isUsuarioOnline = (usuarioId: number): boolean => {
    return usuariosOnline.some((u) => u.usuario.id === usuarioId && u.online);
  };

  if (!user) return null;

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
          <Badge
            badgeContent={totalMensagensNaoLidas > 0 ? totalMensagensNaoLidas : undefined}
            color="error"
            max={99}
          >
            <ChatIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Widget do chat */}
      <Slide direction="up" in={aberto} mountOnEnter unmountOnExit>
        <Paper
          sx={{
            position: 'fixed',
            bottom: isMobile ? 0 : 90,
            right: isMobile ? 0 : 20,
            left: isMobile ? 0 : 'auto',
            top: isMobile ? 0 : 'auto',
            width: isMobile ? '100%' : 800,
            height: isMobile ? '100%' : 600,
            maxHeight: isMobile ? '100%' : 'calc(100vh - 120px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: isMobile ? 'none' : '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 1300,
            borderRadius: isMobile ? 0 : 2,
            overflow: 'hidden',
          }}
        >
          {/* Header principal */}
          {(!conversaSelecionada || isMobile) && (
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {!isConnected && (
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Desconectado
                  </Typography>
                )}
                <IconButton size="small" onClick={() => setAberto(false)} sx={{ color: 'white' }}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
          )}

          {/* Layout de dois painéis */}
          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Painel Esquerdo - Lista de Conversas */}
            {(!isMobile || mostrarListaMobile) && (
              <Box
                sx={{
                  width: isMobile ? '100%' : 320,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  borderRight: isMobile ? 'none' : '1px solid',
                  borderColor: 'divider',
                }}
              >
                {mostrarNovoChat ? (
                  <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <IconButton size="small" onClick={() => setMostrarNovoChat(false)}>
                          <ArrowBackIcon />
                        </IconButton>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                          Nova conversa
                        </Typography>
                      </Box>
                    </Box>
                    {carregandoUsuarios ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : (
                      <Box sx={{ flex: 1, overflow: 'auto' }}>
                        {usuariosDisponiveis
                          .filter((usuario) => usuario.id !== user?.id)
                          .map((usuario) => (
                            <Box
                              key={usuario.id}
                              onClick={() => handleIniciarConversa(usuario.id)}
                              sx={{
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                cursor: 'pointer',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                '&:hover': {
                                  bgcolor: 'action.hover',
                                },
                              }}
                            >
                              <Badge
                                overlap="circular"
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                variant="dot"
                                sx={{
                                  '& .MuiBadge-badge': {
                                    bgcolor: isUsuarioOnline(usuario.id) ? 'success.main' : 'grey.400',
                                  },
                                }}
                              >
                                <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
                                  {usuario.nome?.[0]?.toUpperCase() || 'U'}
                                </Avatar>
                              </Badge>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 500 }}>
                                  {usuario.nome}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {usuario.email}
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                        {usuariosDisponiveis.filter((usuario) => usuario.id !== user?.id).length === 0 && (
                          <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Nenhum usuário disponível
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                ) : (
                  <ChatList
                    conversas={conversas}
                    conversaSelecionada={conversaSelecionada}
                    termoBusca={termoBusca}
                    onTermoBuscaChange={setTermoBusca}
                    onConversaClick={handleConversaClick}
                    onNovaConversaClick={() => setMostrarNovoChat(true)}
                    carregando={carregando}
                    obterNomeConversa={obterNomeConversa}
                    user={user}
                    isUsuarioOnline={isUsuarioOnline}
                  />
                )}
              </Box>
            )}

            {/* Painel Direito - Janela de Conversa */}
            {conversaSelecionada && (!isMobile || !mostrarListaMobile) && (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  height: '100%',
                }}
              >
                        <ChatWindowHeader
                          conversa={conversaSelecionada}
                          obterNomeConversa={obterNomeConversa}
                          usuariosDigitando={usuariosDigitando}
                          isUsuarioOnline={isUsuarioOnline}
                          userId={user?.id}
                          onVoltar={isMobile ? handleVoltar : undefined}
                          onClose={() => setAberto(false)}
                        />
                <ChatMessages mensagens={mensagens} userId={user?.id} />
                <ChatInput
                  value={novaMensagem}
                  onChange={setNovaMensagem}
                  onSend={handleEnviarMensagem}
                  onTypingStart={iniciarDigitando}
                  onTypingStop={pararDigitando}
                  onFocus={zerarMensagensNaoLidasAoFocarInput}
                  enviando={enviando}
                  disabled={!isConnected}
                />
              </Box>
            )}
          </Box>
        </Paper>
      </Slide>
    </>
  );
};
