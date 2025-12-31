import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import chatInternoService, {
    ConversaInterna,
    MensagemInterna,
    UsuarioOnline,
} from '../services/chat-interno.service';
import { useChatInternoWebSocket } from './useChatInternoWebSocket';
import { toast } from 'sonner';
import { playNotificationSound } from '../utils/notificationSound';
import { useSettings } from '../context/SettingsContext';

export const useChatWidget = () => {
    const { user } = useAuth();
    const { settings } = useSettings();
    const [aberto, setAberto] = useState(false);
    const [conversas, setConversas] = useState<ConversaInterna[]>([]);
    const [conversaSelecionada, setConversaSelecionada] = useState<ConversaInterna | null>(null);
    const [mensagens, setMensagens] = useState<MensagemInterna[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<any[]>([]);
    const [usuariosOnline, setUsuariosOnline] = useState<UsuarioOnline[]>([]);
    const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
    const [usuariosDigitando, setUsuariosDigitando] = useState<Set<number>>(new Set());

    // Refs for state access inside callbacks/effects without dependencies
    const conversasRef = useRef<ConversaInterna[]>([]);
    const conversaSelecionadaRef = useRef<ConversaInterna | null>(null);
    const notificacoesAtivasRef = useRef<Map<number, Notification>>(new Map());
    // Map para armazenar textos originais de mensagens otimistas (ID temporário -> texto original)
    const textosOriginaisRef = useRef<Map<number, string>>(new Map());

    // Derived state - cálculo direto para garantir atualização imediata
    const totalMensagensNaoLidas = conversas.reduce((acc, conv) => {
        const naoLidas = conv.mensagensNaoLidas || 0;
        return acc + naoLidas;
    }, 0);
    

    // Sync refs
    useEffect(() => {
        conversasRef.current = conversas;
    }, [conversas]);

    useEffect(() => {
        conversaSelecionadaRef.current = conversaSelecionada;
    }, [conversaSelecionada]);

    // Helpers
    const obterNomeConversa = useCallback((conversa: ConversaInterna): string => {
        if (conversa.tipo === 'GRUPO') {
            return conversa.nome || 'Grupo sem nome';
        }
        if (!conversa.participantes || conversa.participantes.length === 0) {
            return 'Conversa';
        }
        const outroParticipante = conversa.participantes.find((p) => p.usuarioId !== Number(user?.id));
        if (!outroParticipante || !outroParticipante.usuario) {
            return 'Conversa';
        }
        return outroParticipante.usuario.nome || 'Conversa';
    }, [user?.id]);

    const encontrarConversaPorId = useCallback((conversaId: number): ConversaInterna | null => {
        return conversasRef.current.find((c) => c.id === conversaId) || null;
    }, []);

    // State updaters
    const atualizarConversas = useCallback((updater: (prev: ConversaInterna[]) => ConversaInterna[]) => {
        setConversas((prev) => {
            const atualizado = updater(prev);
            // Atualizar ref imediatamente para garantir sincronização
            conversasRef.current = atualizado;
            const totalNaoLidas = atualizado.reduce((acc, conv) => acc + (conv.mensagensNaoLidas || 0), 0);
            return atualizado;
        });
    }, []);

    // Notification cleanup
    const limparNotificacoesConversa = useCallback((conversaId: number) => {
        const notificacao = notificacoesAtivasRef.current.get(conversaId);
        if (notificacao) {
            notificacao.close();
            notificacoesAtivasRef.current.delete(conversaId);
        }

        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.getNotifications({ tag: `chat-${conversaId}` }).then((notifications) => {
                    notifications.forEach((notif) => notif.close());
                });
            });
        }
    }, []);

    const limparTodasNotificacoes = useCallback(() => {
        notificacoesAtivasRef.current.forEach((notificacao) => notificacao.close());
        notificacoesAtivasRef.current.clear();

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.getNotifications().then((notifications) => {
                    notifications.forEach((notif) => {
                        if (notif.tag && notif.tag.startsWith('chat-')) {
                            notif.close();
                        }
                    });
                });
            }).catch(() => { });
        }
    }, []);

    // API Calls
    const carregarConversas = useCallback(async () => {
        try {
            // Don't set loading to true if we already have conversations (silent update)
            if (conversasRef.current.length === 0) setCarregando(true);

            const data = await chatInternoService.listConversas();

            atualizarConversas((prev) => {
                const resultado = data.map((novaConversa) => {
                    const conversaLocal = prev.find((c) => c.id === novaConversa.id);

                    if (!conversaLocal) {
                        return novaConversa;
                    }

                    // Preserve local unread count if it's 0 (meaning we read it locally)
                    // and the backend still thinks it has unread messages (race condition)
                    if (
                        conversaSelecionada?.id === novaConversa.id &&
                        aberto &&
                        conversaLocal.mensagensNaoLidas === 0
                    ) {
                        if (novaConversa.mensagensNaoLidas === 0 || (novaConversa.mensagensNaoLidas || 0) <= (conversaLocal.mensagensNaoLidas || 0)) {
                            return { ...novaConversa, mensagensNaoLidas: 0 };
                        }
                    }

                    // IMPORTANTE: Preserve local count if it's higher (new message arrived locally)
                    // OU se são iguais mas o local foi atualizado recentemente (race condition)
                    const localCount = conversaLocal.mensagensNaoLidas || 0;
                    const backendCount = novaConversa.mensagensNaoLidas || 0;
                    
                    // Se o local é maior, preservar (incremento otimista ainda não sincronizado)
                    if (localCount > backendCount) {
                        return { ...novaConversa, mensagensNaoLidas: localCount };
                    }
                    
                    // Se o backend é maior, usar backend (nova mensagem chegou no servidor)
                    if (backendCount > localCount) {
                        return novaConversa;
                    }
                    
                    // Se são iguais, preservar o local (já está correto e evita flicker)
                    return { ...novaConversa, mensagensNaoLidas: localCount };
                });
                
                // Adicionar conversas do backend que não existem localmente
                const idsLocais = new Set(prev.map(c => c.id));
                const novasDoBackend = data.filter(c => !idsLocais.has(c.id));
                if (novasDoBackend.length > 0) {
                    return [...resultado, ...novasDoBackend];
                }
                
                return resultado;
            });
        } catch (error) {
            console.error('Erro ao carregar conversas', error);
        } finally {
            setCarregando(false);
        }
    }, [atualizarConversas, conversaSelecionada?.id, aberto]);

    const carregarMensagens = useCallback(async (conversaId: number) => {
        try {
            const data = await chatInternoService.getMensagens(conversaId);
            setMensagens(data.mensagens);
        } catch (error) {
            toast.error('Erro ao carregar mensagens');
        }
    }, []);

    const carregarUsuariosDisponiveis = useCallback(async () => {
        try {
            setCarregandoUsuarios(true);
            const usuarios = await chatInternoService.getUsuariosDisponiveis();
            setUsuariosDisponiveis(usuarios);
        } catch (error) {
            // Erro silencioso ao carregar usuários
        } finally {
            setCarregandoUsuarios(false);
        }
    }, []);

    const carregarUsuariosOnline = useCallback(async () => {
        try {
            const usuarios = await chatInternoService.getUsuariosOnline();
            setUsuariosOnline(usuarios);
        } catch (error) {
            // Erro silencioso ao carregar usuários online
        }
    }, []);

    // WebSocket
    const { isConnected, enviarMensagem: enviarMensagemSocket, marcarMensagensComoLidas, iniciarDigitando, pararDigitando } =
        useChatInternoWebSocket({
            conversaId: conversaSelecionada?.id || null,
            enabled: true,
            onNovaMensagem: (mensagem) => {
                if (!user) {
                    return;
                }

                const msgConversaId = Number(mensagem.conversaId);
                const msgRemetenteId = Number(mensagem.remetenteId);
                const userId = Number(user.id);
                // Usar ref para obter o valor mais recente
                const conversaAtual = conversaSelecionadaRef.current;
                const conversaSelecionadaId = conversaAtual ? Number(conversaAtual.id) : null;

                // 1. Message for currently open conversation
                if (msgConversaId === conversaSelecionadaId && aberto) {
                    // Verificar se a mensagem já existe para evitar duplicatas
                    setMensagens((prev) => {
                        // Se é mensagem própria, procurar por mensagem otimista (ID temporário negativo)
                        if (msgRemetenteId === userId) {
                            // Procurar mensagem otimista recente (últimos 10 segundos)
                            const agora = Date.now();
                            const mensagemOtimista = prev.find((m) => 
                                m.remetenteId === userId && 
                                m.conversaId === msgConversaId &&
                                m.id < 0 && // ID temporário negativo
                                Math.abs(agora + m.id) < 10000 // Criada nos últimos 10 segundos
                            );
                            
                            if (mensagemOtimista) {
                                // Obter texto original do ref
                                const textoOriginal = textosOriginaisRef.current.get(mensagemOtimista.id) || mensagemOtimista.conteudo;
                                
                                // Substituir mensagem otimista pela mensagem real, mas preservar texto original
                                // Remover texto original do ref
                                textosOriginaisRef.current.delete(mensagemOtimista.id);
                                
                                return prev.map((m) => 
                                    m.id === mensagemOtimista.id
                                        ? { ...mensagem, conteudo: textoOriginal } // Preservar texto original
                                        : m
                                );
                            }
                        }
                        
                        // Verificar se já existe mensagem com mesmo ID
                        const existe = prev.some((m) => m.id === mensagem.id);
                        if (existe) {
                            // Se é mensagem própria e já existe, preservar o texto original
                            if (msgRemetenteId === userId) {
                                return prev.map((m) => 
                                    m.id === mensagem.id 
                                        ? { ...m, ...mensagem, conteudo: m.conteudo } // Preservar conteúdo original
                                        : m
                                );
                            }
                            return prev;
                        }
                        return [...prev, mensagem];
                    });
                    marcarMensagensComoLidas(msgConversaId);

                    atualizarConversas((prev) =>
                        prev.map((c) =>
                            c.id === msgConversaId ? { ...c, mensagensNaoLidas: 0 } : c
                        )
                    );
                }
                // 2. Message for another conversation (or chat closed)
                else if (msgRemetenteId !== userId) {
                    const conversasAtual = conversasRef.current;
                    const conversaExistente = conversasAtual.find((c) => c.id === msgConversaId);
                    const nomeRemetente = mensagem.remetente?.nome || 'Alguém';
                    const nomeConversa = conversaExistente ? obterNomeConversa(conversaExistente) : nomeRemetente;

                    // Optimistic update - FORÇAR atualização imediata do estado
                    atualizarConversas((prev) => {
                        console.log('[useChatWidget] Running optimistic update. Prev conversas:', prev.length);
                        const conversaLocal = prev.find((c) => c.id === msgConversaId);

                        if (conversaLocal) {
                            console.log('[useChatWidget] Found local conversation. Current unread:', conversaLocal.mensagensNaoLidas);
                            const atualizadas = prev.map((c) =>
                                c.id === msgConversaId
                                    ? {
                                        ...c,
                                        mensagensNaoLidas: (c.mensagensNaoLidas || 0) + 1,
                                        updatedAt: mensagem.createdAt,
                                    }
                                    : c
                            ).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

                            const updatedConv = atualizadas.find(c => c.id === msgConversaId);
                            const novoTotal = atualizadas.reduce((acc, conv) => acc + (conv.mensagensNaoLidas || 0), 0);
                            console.log('[useChatWidget] Updated conversation. New unread:', updatedConv?.mensagensNaoLidas, 'Novo total:', novoTotal);
                            return atualizadas;
                        }

                        console.log('[useChatWidget] Conversation not found locally. Creating placeholder.');
                        // New conversation placeholder
                        const placeholder: ConversaInterna = {
                            id: msgConversaId,
                            tipo: 'INDIVIDUAL',
                            nome: nomeConversa,
                            clinicaId: conversaExistente?.clinicaId || user?.clinicaId || 0,
                            criadoPor: conversaExistente?.criadoPor || msgRemetenteId,
                            createdAt: mensagem.createdAt,
                            updatedAt: mensagem.createdAt,
                            participantes: conversaExistente?.participantes || [],
                            mensagens: [],
                            mensagensNaoLidas: 1,
                        };
                        const novasConversas = [placeholder, ...prev];
                        const novoTotal = novasConversas.reduce((acc, conv) => acc + (conv.mensagensNaoLidas || 0), 0);
                        console.log('[useChatWidget] Created placeholder. Novo total:', novoTotal);
                        return novasConversas;
                    });

                    // NÃO chamar carregarConversas() imediatamente após atualização otimista
                    // O backend será sincronizado naturalmente quando necessário
                    // Isso evita que o merge sobrescreva o incremento local

                    // Notification
                    if (!aberto || msgConversaId !== conversaSelecionadaId) {
                        console.log('[useChatWidget] Should show notification for:', nomeRemetente);

                        // Reproduzir som apenas se estiver habilitado nas configurações
                        // Usar som de chat (não agendamento)
                        if (settings.notifications.soundEnabled) {
                            playNotificationSound(settings.notifications.soundType);
                        }

                        // Sempre mostrar toast (notificação local na página)
                        // A configuração browserNotificationsEnabled controla apenas as push notifications do navegador
                        toast.info(`${nomeRemetente}`, {
                            description: mensagem.conteudo.length > 100 ? mensagem.conteudo.substring(0, 100) + '...' : mensagem.conteudo,
                            duration: 1000,
                            action: {
                                label: 'Abrir',
                                onClick: () => {
                                    limparNotificacoesConversa(msgConversaId);
                                    setAberto(true);
                                    // Allow state to settle before selecting
                                    setTimeout(() => {
                                        const conv = encontrarConversaPorId(msgConversaId);
                                        if (conv) {
                                            selecionarConversa(conv);
                                        } else {
                                            carregarConversas().then(() => {
                                                const conv2 = encontrarConversaPorId(msgConversaId);
                                                if (conv2) selecionarConversa(conv2);
                                            });
                                        }
                                    }, 100);
                                },
                            },
                        });

                        // Browser Notification
                        if ('Notification' in window && Notification.permission === 'granted' && !aberto) {
                            const notif = new Notification(nomeConversa, {
                                body: mensagem.conteudo,
                                tag: `chat-${msgConversaId}`,
                            });
                            notificacoesAtivasRef.current.set(msgConversaId, notif);
                            notif.onclick = () => {
                                window.focus();
                                notif.close();
                                setAberto(true);
                                setTimeout(() => {
                                    const conv = encontrarConversaPorId(msgConversaId);
                                    if (conv) selecionarConversa(conv);
                                }, 100);
                            };
                        }
                    }
                }
            },
            onMensagensLidas: (data) => {
                // IMPORTANTE: Só atualizar se:
                // 1. A conversa está aberta e selecionada (usuário está vendo)
                // 2. OU o usuário atual é quem marcou como lida (ele mesmo)
                const conversaEstaAberta = conversaSelecionada?.id === data.conversaId && aberto;
                const usuarioMarcouComoLida = Number(data.usuarioId) === Number(user?.id);

                if (!conversaEstaAberta && !usuarioMarcouComoLida) {
                    console.log('[useChatWidget] Ignorando mensagens:lidas - conversa não está aberta e não foi o usuário atual quem marcou');
                    return; // Não fazer nada se a conversa não está aberta e não foi o usuário atual
                }

                console.log('[useChatWidget] Processando mensagens:lidas', { conversaEstaAberta, usuarioMarcouComoLida });

                setMensagens((prev) =>
                    prev.map((msg) =>
                        msg.conversaId === data.conversaId && msg.remetenteId !== data.usuarioId
                            ? { ...msg, status: 'LIDA' as const }
                            : msg
                    )
                );

                // Só zerar o contador se a conversa está aberta e selecionada
                if (conversaEstaAberta) {
                    atualizarConversas((prev) =>
                        prev.map((c) =>
                            c.id === data.conversaId ? { ...c, mensagensNaoLidas: 0 } : c
                        )
                    );
                }
            },
            onDigitando: (data) => {
                if (data.conversaId === conversaSelecionada?.id) {
                    setUsuariosDigitando((prev) => {
                        const novo = new Set(prev);
                        data.digitando ? novo.add(data.usuarioId) : novo.delete(data.usuarioId);
                        return novo;
                    });
                }
            },
            onUsuarioOnline: (data) => {
                console.log('[useChatWidget] Usuário ficou online:', data);
                setUsuariosOnline((prev) => {
                    // Verificar se o usuário já está na lista
                    const existe = prev.find((u) => u.usuario.id === data.userId);
                    if (existe) {
                        // Atualizar status
                        return prev.map((u) =>
                            u.usuario.id === data.userId
                                ? { ...u, online: true, ultimaVezOnline: new Date().toISOString() }
                                : u
                        );
                    }
                    // Adicionar novo usuário online
                    return [
                        ...prev,
                        {
                            id: data.userId, // Adicionar id no nível raiz (requerido pela interface)
                            usuario: {
                                id: data.userId,
                                nome: data.nome || 'Usuário',
                                email: '',
                                role: 'DOUTOR' as const,
                            },
                            online: true,
                            ultimaVezOnline: new Date().toISOString(),
                        },
                    ];
                });
            },
            onUsuarioOffline: (data) => {
                console.log('[useChatWidget] Usuário ficou offline:', data);
                setUsuariosOnline((prev) => {
                    // Remover completamente da lista de usuários online
                    return prev.filter((u) => u.usuario.id !== data.userId);
                });
            },
        });

    // Actions
    const selecionarConversa = useCallback((conversa: ConversaInterna) => {
        limparNotificacoesConversa(conversa.id);

        atualizarConversas((prev) =>
            prev.map((c) => c.id === conversa.id ? { ...c, mensagensNaoLidas: 0 } : c)
        );

        marcarMensagensComoLidas(conversa.id);
        setConversaSelecionada(conversa);
        carregarMensagens(conversa.id);

        if (!aberto) setAberto(true);
    }, [aberto, atualizarConversas, carregarMensagens, marcarMensagensComoLidas, limparNotificacoesConversa]);

    const enviarMensagem = useCallback(async (conteudo: string, textoOriginal?: string) => {
        if (!conversaSelecionada || !user) return;
        try {
            // Se temos texto original, adicionar mensagem otimista com o texto original
            // Isso garante que o remetente veja sua própria mensagem sem criptografia
            if (textoOriginal && textoOriginal !== conteudo) {
                const idTemporario = -Date.now(); // ID temporário negativo para identificar como otimista
                const mensagemOtimista: MensagemInterna = {
                    id: idTemporario,
                    conversaId: conversaSelecionada.id,
                    remetenteId: user.id,
                    tipo: 'TEXTO',
                    conteudo: textoOriginal, // Texto original, não criptografado
                    status: 'ENVIADA',
                    editada: false,
                    createdAt: new Date().toISOString(),
                    remetente: {
                        id: user.id,
                        nome: user.nome || '',
                        email: user.email || '',
                        role: user.role || 'DOUTOR',
                    },
                };
                
                // Armazenar texto original associado ao ID temporário
                textosOriginaisRef.current.set(idTemporario, textoOriginal);
                
                // Adicionar mensagem otimista ao estado local
                setMensagens((prev) => [...prev, mensagemOtimista]);
                console.log('[useChatWidget] Mensagem otimista adicionada com texto original, ID temporário:', idTemporario);
            }
            
            enviarMensagemSocket({
                conversaId: conversaSelecionada.id,
                tipo: 'TEXTO',
                conteudo: conteudo, // Conteúdo criptografado (se aplicável)
            });
            pararDigitando(conversaSelecionada.id);
        } catch (error) {
            toast.error('Erro ao enviar mensagem');
        }
    }, [conversaSelecionada, enviarMensagemSocket, pararDigitando, user]);

    const iniciarConversa = useCallback(async (usuarioId: number) => {
        try {
            const conversa = await chatInternoService.createConversaIndividual(usuarioId);
            if (conversa) {
                selecionarConversa(conversa);
                await carregarConversas();
                return true;
            }
        } catch (error) {
            toast.error('Erro ao iniciar conversa');
        }
        return false;
    }, [selecionarConversa, carregarConversas]);

    // Effects
    useEffect(() => {
        carregarConversas();
    }, [carregarConversas]);

    useEffect(() => {
        if (aberto) {
            carregarConversas();
            carregarUsuariosDisponiveis();
            carregarUsuariosOnline();
            limparTodasNotificacoes();
        }
    }, [aberto, carregarConversas, carregarUsuariosDisponiveis, carregarUsuariosOnline, limparTodasNotificacoes]);

    // Recarregar mensagens quando o chat é aberto e há uma conversa selecionada
    // Isso garante que mensagens recebidas enquanto o chat estava fechado sejam exibidas
    useEffect(() => {
        if (aberto && conversaSelecionada) {
            console.log('[useChatWidget] Chat aberto com conversa selecionada, recarregando mensagens da conversa:', conversaSelecionada.id);
            
            // Zerar mensagens não lidas imediatamente (otimista)
            atualizarConversas((prev) =>
                prev.map((c) =>
                    c.id === conversaSelecionada.id ? { ...c, mensagensNaoLidas: 0 } : c
                )
            );
            
            // Carregar mensagens e marcar como lidas
            carregarMensagens(conversaSelecionada.id);
            marcarMensagensComoLidas(conversaSelecionada.id);
        }
    }, [aberto, conversaSelecionada?.id, carregarMensagens, marcarMensagensComoLidas, atualizarConversas]);

    // Atualizar lista de usuários online periodicamente (a cada 30 segundos)
    useEffect(() => {
        if (!aberto) return;

        const interval = setInterval(() => {
            carregarUsuariosOnline();
        }, 30000); // 30 segundos

        return () => clearInterval(interval);
    }, [aberto, carregarUsuariosOnline]);

    // Zerar mensagens não lidas quando o input receber foco
    const zerarMensagensNaoLidasAoFocarInput = useCallback(() => {
        if (conversaSelecionada && aberto) {
            console.log('[useChatWidget] Input recebeu foco, zerando mensagens não lidas da conversa:', conversaSelecionada.id);
            
            // Zerar mensagens não lidas imediatamente (otimista)
            atualizarConversas((prev) =>
                prev.map((c) =>
                    c.id === conversaSelecionada.id ? { ...c, mensagensNaoLidas: 0 } : c
                )
            );
            
            // Marcar como lidas no backend
            marcarMensagensComoLidas(conversaSelecionada.id);
        }
    }, [conversaSelecionada, aberto, atualizarConversas, marcarMensagensComoLidas]);

    return {
        // State
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

        // Actions
        selecionarConversa,
        enviarMensagem,
        iniciarConversa,
        iniciarDigitando: () => conversaSelecionada && iniciarDigitando(conversaSelecionada.id),
        pararDigitando: () => conversaSelecionada && pararDigitando(conversaSelecionada.id),
        obterNomeConversa,
        zerarMensagensNaoLidasAoFocarInput,
    };
};
