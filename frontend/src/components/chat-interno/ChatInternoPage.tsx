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
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Search as SearchIcon,
  Group as GroupIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import chatInternoService, {
  ConversaInterna,
  MensagemInterna,
} from '../../services/chat-interno.service';
import { useChatInternoWebSocket } from '../../hooks/useChatInternoWebSocket';
import { ChatMessages } from './ChatMessages';
import { useChatEncryption } from '../../hooks/useChatEncryption';
import { toast } from 'sonner';

export const ChatInternoPage: React.FC = () => {
  const { user } = useAuth();
  const { encryptMessage, isInitialized } = useChatEncryption();
  const [conversas, setConversas] = useState<ConversaInterna[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<ConversaInterna | null>(null);
  const [mensagens, setMensagens] = useState<MensagemInterna[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const mensagensEndRef = useRef<HTMLDivElement>(null);
  const [usuariosDigitando, setUsuariosDigitando] = useState<Set<number>>(new Set());
  const notificacoesAtivasRef = useRef<Map<number, Notification>>(new Map()); // Rastrear notificações por conversaId
  const conversaSelecionadaRef = useRef<ConversaInterna | null>(null); // Ref para acessar valor atualizado no callback

  // Função para limpar notificações de uma conversa
  const limparNotificacoesConversa = (conversaId: number) => {
    // Fechar notificações do navegador
    const notificacao = notificacoesAtivasRef.current.get(conversaId);
    if (notificacao) {
      notificacao.close();
      notificacoesAtivasRef.current.delete(conversaId);
    }

    // Fechar todas as notificações com o mesmo tag via Service Worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.getNotifications({ tag: `chat-${conversaId}` }).then((notifications) => {
          notifications.forEach((notif) => notif.close());
        });
      });
    }
  };


  const { isConnected, enviarMensagem, marcarMensagensComoLidas, iniciarDigitando, pararDigitando } =
    useChatInternoWebSocket({
      conversaId: conversaSelecionada?.id || null,
      enabled: true, // Sempre conectado para receber notificações
      onNovaMensagem: (mensagem) => {
        console.log('[ChatInternoPage] Nova mensagem recebida:', {
          conversaId: mensagem.conversaId,
          remetenteId: mensagem.remetenteId,
          userId: user?.id,
          conversaSelecionadaId: conversaSelecionadaRef.current?.id,
        });

        // Usar ref para obter o valor mais recente da conversa selecionada
        const conversaAtual = conversaSelecionadaRef.current;

        // Se a mensagem é para a conversa selecionada e está visível
        if (mensagem.conversaId === conversaAtual?.id) {
          console.log('[ChatInternoPage] Adicionando mensagem à conversa aberta');
          // Verificar se a mensagem já existe para evitar duplicatas
          setMensagens((prev) => {
            // Verificar se a mensagem já existe pelo ID
            const existe = prev.some((m) => m.id === mensagem.id);
            if (existe) {
              console.log('[ChatInternoPage] Mensagem já existe, ignorando duplicata');
              return prev;
            }
            console.log('[ChatInternoPage] Adicionando nova mensagem ao array');
            return [...prev, mensagem];
          });
          marcarMensagensComoLidas(mensagem.conversaId);
          
          // ATUALIZAÇÃO IMEDIATA: Zerar contador quando mensagem é recebida na conversa aberta
          setConversas((prev) =>
            prev.map((c) =>
              c.id === mensagem.conversaId
                ? { ...c, mensagensNaoLidas: 0 }
                : c
            )
          );
        } else if (mensagem.remetenteId !== user?.id) {
          // Se a mensagem não é do próprio usuário e não está na conversa aberta, mostrar notificação
          console.log('[ChatInternoPage] Mostrando notificação para mensagem de outro usuário');
          
          // Obter nome do remetente e da conversa (usar estado atual)
          const conversa = conversas.find((c) => c.id === mensagem.conversaId);
          const nomeRemetente = mensagem.remetente?.nome || 'Alguém';
          const nomeConversa = conversa ? obterNomeConversa(conversa) : nomeRemetente;
          
          // ATUALIZAÇÃO IMEDIATA: Incrementar contador localmente quando nova mensagem chega
          setConversas((prev) => {
            const conversaExistente = prev.find((c) => c.id === mensagem.conversaId);
            if (conversaExistente) {
              return prev.map((c) =>
                c.id === mensagem.conversaId
                  ? { ...c, mensagensNaoLidas: (c.mensagensNaoLidas || 0) + 1 }
                  : c
              );
            }
            return prev;
          });
          
          // Mostrar notificações IMEDIATAMENTE (fora do setState)
          // Mostrar toast com ação para abrir o chat
          toast.info(`${nomeRemetente}`, {
            description: mensagem.conteudo.length > 100 ? mensagem.conteudo.substring(0, 100) + '...' : mensagem.conteudo,
            duration: 5000,
            action: {
              label: 'Abrir',
              onClick: () => {
                // Limpar notificações imediatamente ao clicar em "Abrir"
                limparNotificacoesConversa(mensagem.conversaId);
                
                // Aguardar um pouco para garantir que conversas foram carregadas
                setTimeout(() => {
                  const conv = conversas.find((c) => c.id === mensagem.conversaId);
                  if (conv) {
                    setConversaSelecionada(conv);
                    // Marcar como lidas imediatamente
                    marcarMensagensComoLidas(mensagem.conversaId);
                  } else {
                    // Se não encontrou, recarregar conversas e tentar novamente
                    carregarConversas().then(() => {
                      const conv2 = conversas.find((c) => c.id === mensagem.conversaId);
                      if (conv2) {
                        setConversaSelecionada(conv2);
                        marcarMensagensComoLidas(mensagem.conversaId);
                      }
                    });
                  }
                }, 100);
              },
            },
          });

          // Mostrar notificação do navegador (Web Push) apenas se tiver permissão
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              // Fechar notificação anterior da mesma conversa se existir
              const notificacaoAnterior = notificacoesAtivasRef.current.get(mensagem.conversaId);
              if (notificacaoAnterior) {
                try {
                  notificacaoAnterior.close();
                } catch (e) {
                  // Ignorar
                }
              }

              const notificacao = new Notification(nomeConversa, {
                body: mensagem.conteudo.length > 50 ? mensagem.conteudo.substring(0, 50) + '...' : mensagem.conteudo,
                icon: '/icon-192x192.svg',
                tag: `chat-${mensagem.conversaId}`,
                requireInteraction: false,
              });

              // Armazenar referência da notificação
              notificacoesAtivasRef.current.set(mensagem.conversaId, notificacao);

              // Limpar notificação quando clicada
              notificacao.onclick = () => {
                limparNotificacoesConversa(mensagem.conversaId);
                window.focus();
                setTimeout(() => {
                  const conv = conversas.find((c) => c.id === mensagem.conversaId);
                  if (conv) {
                    setConversaSelecionada(conv);
                    limparNotificacoesConversa(mensagem.conversaId);
                    marcarMensagensComoLidas(mensagem.conversaId);
                  }
                }, 100);
                notificacao.close();
              };

              // Limpar referência quando a notificação for fechada
              notificacao.onclose = () => {
                notificacoesAtivasRef.current.delete(mensagem.conversaId);
              };
            } catch (error) {
              console.error('[ChatInternoPage] Erro ao criar notificação:', error);
            }
          }
          
          // Sincronizar com backend em background (sem bloquear UI)
          carregarConversas();
        } else {
          // Se é mensagem do próprio usuário, apenas recarregar conversas
          carregarConversas();
        }
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
        
        // ATUALIZAÇÃO IMEDIATA DO ESTADO LOCAL - Zerar contador quando mensagens são marcadas como lidas
        setConversas((prev) =>
          prev.map((c) =>
            c.id === data.conversaId
              ? { ...c, mensagensNaoLidas: 0 }
              : c
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
    // Atualizar ref sempre que conversaSelecionada mudar
    conversaSelecionadaRef.current = conversaSelecionada;
  }, [conversaSelecionada]);

  useEffect(() => {
    if (conversaSelecionada) {
      // Limpar notificações da conversa específica
      limparNotificacoesConversa(conversaSelecionada.id);
      
      // ATUALIZAÇÃO IMEDIATA DO ESTADO LOCAL - Zerar contador antes de qualquer requisição
      setConversas((prev) =>
        prev.map((c) =>
          c.id === conversaSelecionada.id
            ? { ...c, mensagensNaoLidas: 0 }
            : c
        )
      );
      
      // Marcar mensagens como lidas no backend (via WebSocket)
      marcarMensagensComoLidas(conversaSelecionada.id);
      
      // Carregar mensagens
      carregarMensagens(conversaSelecionada.id);
      
      // Sincronizar com backend em background (sem bloquear UI)
      carregarConversas();
    }
  }, [conversaSelecionada]);

  // Removido: scroll agora é gerenciado pelo componente ChatMessages

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
      let conteudoParaEnviar = novaMensagem.trim();

      // Criptografar mensagem se E2E estiver inicializado
      if (isInitialized && conversaSelecionada.tipo === 'INDIVIDUAL') {
        try {
          // Encontrar o ID do outro participante
          const outroParticipante = conversaSelecionada.participantes.find(
            (p) => p.usuarioId !== user?.id
          );
          
          if (outroParticipante) {
            conteudoParaEnviar = await encryptMessage(novaMensagem.trim(), outroParticipante.usuarioId);
            console.log('[E2E] Mensagem criptografada antes de enviar');
          }
        } catch (error) {
          console.error('[E2E] Erro ao criptografar, enviando sem criptografia:', error);
          // Continuar com mensagem original em caso de erro
        }
      }

      enviarMensagem({
        conversaId: conversaSelecionada.id,
        tipo: 'TEXTO',
        conteudo: conteudoParaEnviar,
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
                onClick={() => {
                  // Limpar notificações imediatamente ao clicar na conversa
                  limparNotificacoesConversa(conversa.id);
                  
                  // ATUALIZAÇÃO IMEDIATA DO ESTADO LOCAL - Zerar contador antes de qualquer requisição
                  setConversas((prev) =>
                    prev.map((c) =>
                      c.id === conversa.id
                        ? { ...c, mensagensNaoLidas: 0 }
                        : c
                    )
                  );
                  
                  // Marcar como lidas imediatamente
                  marcarMensagensComoLidas(conversa.id);
                  
                  setConversaSelecionada(conversa);
                }}
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
          <ChatMessages 
            mensagens={mensagens} 
            userId={user?.id} 
            conversaId={conversaSelecionada.id}
          />

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

