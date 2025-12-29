import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Paper, Typography, Avatar } from '@mui/material';
import { MensagemInterna } from '../../services/chat-interno.service';
import { useChatEncryption } from '../../hooks/useChatEncryption';
import { useAuth } from '../../hooks/useAuth';

interface ChatMessagesProps {
  mensagens: MensagemInterna[];
  userId: number | undefined;
  conversaId: number | undefined;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ mensagens, userId, conversaId }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<number, string>>(new Map());
  // Map para armazenar o texto original das mensagens próprias (antes de criptografar)
  const [originalMessages, setOriginalMessages] = useState<Map<number, string>>(new Map());
  const { decryptMessage, isInitialized } = useChatEncryption();
  const { user } = useAuth();

  // Descriptografar mensagens quando necessário (em tempo real)
  useEffect(() => {
    const decryptAll = async () => {
      // Se não está inicializado, usar conteúdo original
      if (!isInitialized || !conversaId || !user?.id) {
        const original = new Map<number, string>();
        mensagens.forEach((msg) => original.set(msg.id, msg.conteudo));
        setDecryptedMessages(original);
        return;
      }

      // Preservar mensagens já descriptografadas
      const decrypted = new Map<number, string>(decryptedMessages);
      
      // Identificar mensagens que precisam ser descriptografadas
      const messagesToDecrypt = mensagens.filter((msg) => {
        // Se já está descriptografada, pular
        if (decrypted.has(msg.id)) {
          return false;
        }
        // NÃO descriptografar mensagens próprias - o remetente já sabe o conteúdo original
        // Sanity check: se é mensagem própria e já está em texto plano, não tentar descriptografar
        if (msg.remetenteId === user.id) {
          // Verificar se está criptografada (formato iv:ciphertext)
          const isEncrypted = msg.conteudo.includes(':') && msg.conteudo.split(':').length === 2;
          if (!isEncrypted) {
            // Já está em texto plano, não precisa descriptografar
            return false;
          }
          // Se estiver criptografada, também não descriptografar (mensagem otimista deve ter preservado o texto original)
          return false;
        }
        // Verificar se é mensagem criptografada (formato: iv:ciphertext)
        const firstColonIndex = msg.conteudo.indexOf(':');
        return firstColonIndex > 0 && firstColonIndex < msg.conteudo.length - 1;
      });
      
      console.log(`[E2E] Descriptografando ${messagesToDecrypt.length} mensagens de ${mensagens.length} total`);
      
      // Descriptografar apenas mensagens novas
      const decryptPromises = messagesToDecrypt.map(async (msg) => {
        try {
          // O senderId é o remetenteId da mensagem
          const senderId = msg.remetenteId;
          
          console.log(`[E2E-DEBUG] Descriptografando mensagem ${msg.id} de remetente ${senderId}, payload preview: ${msg.conteudo.substring(0, 50)}...`);
          const decryptedContent = await decryptMessage(msg.conteudo, senderId);
          
          // Verificar se a descriptografia retornou erro específico
          if (decryptedContent === '⚠️ Falha na descriptografia') {
            console.error(`[E2E-DEBUG] ✗ Mensagem ${msg.id} falhou na descriptografia após retry`);
            // Marcar como falha para tratamento visual (indicando troca de segurança)
            decrypted.set(msg.id, 'DECRYPTION_FAILED');
          } else {
            decrypted.set(msg.id, decryptedContent);
            console.log(`[E2E-DEBUG] ✓ Mensagem ${msg.id} descriptografada com sucesso`);
          }
        } catch (error) {
          console.error(`[E2E-DEBUG] ✗ Erro inesperado ao descriptografar mensagem ${msg.id}:`, error);
          // Marcar como falha para tratamento visual (indicando troca de segurança)
          decrypted.set(msg.id, 'DECRYPTION_FAILED');
        }
      });
      
      // Adicionar mensagens não criptografadas também
      mensagens.forEach((msg) => {
        if (!decrypted.has(msg.id)) {
          decrypted.set(msg.id, msg.conteudo);
        }
      });
      
      await Promise.all(decryptPromises);
      setDecryptedMessages(decrypted);
    };

    decryptAll();
  }, [mensagens, isInitialized, conversaId, user?.id, decryptMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, decryptedMessages]);

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
              <Typography 
                variant="body2" 
                sx={{ 
                  fontSize: '0.9375rem', 
                  wordBreak: 'break-word',
                  // Estilo especial para mensagens com falha na descriptografia
                  ...(decryptedMessages.get(mensagem.id) === 'DECRYPTION_FAILED' && {
                    color: 'warning.main',
                    fontStyle: 'italic',
                    opacity: 0.9,
                  }),
                }}
              >
                {(() => {
                  const isMine = mensagem.remetenteId === userId;
                  
                  // Se é mensagem própria, não descriptografar
                  // A mensagem otimista já foi adicionada com o texto original
                  // Quando a mensagem real retornar via WebSocket, o texto original será preservado
                  if (isMine) {
                    // Sanity check: se é mensagem própria e já está em texto plano, retornar diretamente
                    const isEncrypted = mensagem.conteudo.includes(':') && mensagem.conteudo.split(':').length === 2;
                    if (!isEncrypted) {
                      // Já está em texto plano, retornar diretamente
                      return mensagem.conteudo;
                    }
                    // Se estiver criptografada, significa que a mensagem otimista não funcionou
                    // Isso não deveria acontecer, mas vamos tratar graciosamente
                    console.warn('[E2E-DEBUG] Mensagem própria está criptografada - mensagem otimista pode não ter funcionado');
                    return '[Mensagem criptografada - texto original não disponível]';
                  }
                  
                  // Se é mensagem de outro usuário, descriptografar
                  const decrypted = decryptedMessages.get(mensagem.id);
                  
                  // Tratamento visual para mensagens que falharam na descriptografia
                  if (decrypted === 'DECRYPTION_FAILED') {
                    return (
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>🔒</span>
                        <span>Esta mensagem não pode ser descriptografada devido a uma troca de chaves de segurança. O remetente pode ter regenerado suas chaves.</span>
                      </Box>
                    );
                  }
                  
                  // Se ainda não foi descriptografada, mostrar "Descriptografando..." temporariamente
                  if (isInitialized && mensagem.conteudo.includes(':') && !decrypted) {
                    return 'Descriptografando...';
                  }
                  
                  // Retornar conteúdo descriptografado ou original
                  return decrypted || mensagem.conteudo;
                })()}
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
      <div ref={messagesEndRef} style={{ height: 0 }} />
    </Box>
  );
};

