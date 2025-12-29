import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Typography, CircularProgress, Paper, alpha } from '@mui/material';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment/locale/pt-br';
import { getChatHistory, IChatMessage } from '../../services/chat.service';
import { useChatEncryption } from '../../hooks/useChatEncryption';
import { useAuth } from '../../hooks/useAuth';

interface ChatHistoryProps {
  pacienteId: number | null;
  newMessages: IChatMessage[];
}

moment.locale('pt-br');

export const ChatHistory: React.FC<ChatHistoryProps> = ({ pacienteId, newMessages }) => {
  const [history, setHistory] = useState<IChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<number, string>>(new Map());
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const { decryptMessage, isInitialized } = useChatEncryption();
  const { user } = useAuth();

  const fetchHistory = async (id: number) => {
    try {
      setLoading(true);
      const data = await getChatHistory(id);
      setHistory(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar histórico do chat.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pacienteId) {
      fetchHistory(pacienteId);
    } else {
      setHistory([]);
    }
  }, [pacienteId]);

  const combinedHistory = [...history, ...newMessages];

  // Descriptografar mensagens quando necessário
  useEffect(() => {
    if (!isInitialized || !pacienteId || !user?.id) {
      return;
    }

    const decryptAll = async () => {
      const decrypted = new Map<number, string>();
      
      for (const msg of combinedHistory) {
        // Verificar se é mensagem criptografada (formato: iv:ciphertext)
        const isEncrypted = msg.content.includes(':') && msg.content.split(':').length === 2;
        
        if (isEncrypted) {
          try {
            // Determinar o senderId baseado no senderType
            // Se for mensagem do paciente, o senderId é o pacienteId
            // Se for mensagem do doutor, o senderId é o user.id
            const senderId = msg.senderType === 'PACIENTE' ? pacienteId : Number(user.id);
            
            const decryptedContent = await decryptMessage(msg.content, senderId);
            decrypted.set(msg.id || 0, decryptedContent);
          } catch (error) {
            console.error(`[E2E] Erro ao descriptografar mensagem ${msg.id}:`, error);
            decrypted.set(msg.id || 0, msg.content); // Fallback para original
          }
        } else {
          // Mensagem não criptografada (antiga ou da IA)
          decrypted.set(msg.id || 0, msg.content);
        }
      }
      
      setDecryptedMessages(decrypted);
    };

    decryptAll();
  }, [combinedHistory, isInitialized, pacienteId, user?.id, decryptMessage]);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [combinedHistory, decryptedMessages]);

  const renderMessage = (msg: IChatMessage) => {
    const isPaciente = msg.senderType === 'PACIENTE';
    const isIA = msg.senderType === 'IA';

    // Usar mensagem descriptografada se disponível, senão usar original
    let content = decryptedMessages.get(msg.id || 0) || msg.content;

    if (isIA) {
      try {
        const aiMsg = JSON.parse(msg.content);
        if (aiMsg.tool_calls && Array.isArray(aiMsg.tool_calls) && aiMsg.tool_calls.length > 0) {
          content = `[IA chamou a ferramenta: ${aiMsg.tool_calls[0].name}]`;
        } else if (aiMsg.content) {
          content = aiMsg.content;
        }
      } catch (error) {
        // ignore json parse errors
      }
    }

    const align = isPaciente ? 'flex-start' : 'flex-end';
    const bgColor = isPaciente ? '#FFFFFF' : isIA ? alpha('#e0e7ff', 0.8) : '#dcfce7';
    const textColor = isIA ? '#3730a3' : '#333';
    const alignBubble = isPaciente ? 'left' : 'right';

    return (
      <Box
        key={msg.id || `new-${msg.createdAt}`}
        sx={{
          display: 'flex',
          justifyContent: align,
          mb: 1.5,
        }}
      >
        <Paper
          elevation={1}
          sx={{
            p: 1.5,
            borderRadius: 4,
            borderTopLeftRadius: isPaciente ? 0 : 4,
            borderTopRightRadius: isPaciente ? 4 : 0,
            maxWidth: '70%',
            bgcolor: bgColor,
            color: textColor,
            textAlign: alignBubble,
          }}
        >
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {content}
          </Typography>
          <Typography
            variant="caption"
            display="block"
            sx={{
              color: 'text.secondary',
              mt: 0.5,
              fontSize: '0.65rem',
              opacity: 0.8,
            }}
          >
            {moment(msg.createdAt).format('HH:mm')}
          </Typography>
        </Paper>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!pacienteId) {
    return null;
  }

  return (
    <Box
      ref={chatBoxRef}
      sx={{
        height: '100%',
        overflowY: 'auto',
        p: 2,
        bgcolor: alpha('#f4f4f5', 0.5),
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      {combinedHistory.length === 0 ? (
        <Typography variant="body2" color="text.secondary" align="center">
          Nenhuma mensagem no histórico.
        </Typography>
      ) : (
        combinedHistory.map(renderMessage)
      )}
    </Box>
  );
};


