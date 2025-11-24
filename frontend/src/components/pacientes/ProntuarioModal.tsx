import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Avatar,
  Chip,
  Divider,
  TextField,
  IconButton,
  Stack,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Select,
  MenuItem,
  InputAdornment,
  InputLabel,
  FormControl,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import WarningIcon from '@mui/icons-material/Warning';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReactMarkdown from 'react-markdown';
import type { Components as ReactMarkdownComponents } from 'react-markdown';
import { IAgendamento, IHistoricoPaciente, IPaciente, IDoutor, IProntuarioChatMessage, IPrescricao } from '../../types/models';
import { getPacienteHistoricos, updatePaciente, updateHistoricoPaciente } from '../../services/paciente.service';
import { getDoutores } from '../../services/doutor.service';
import { getProntuarioChatMessages, sendProntuarioChatMessage } from '../../services/prontuarioChat.service';
import { getPrescricoesPaciente, createPrescricao, getPrescricaoByProtocolo } from '../../services/prescricao.service';
import { useAuth } from '../../hooks/useAuth';
import moment from 'moment';
import 'moment/locale/pt-br';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import PrescricaoPdfView from '../PrescricaoPdfView';
import { IModeloPrescricaoPDF, modeloPrescricaoPadrao } from '../../types/prescricao';

moment.locale('pt-br');

interface Props {
  open: boolean;
  onClose: () => void;
  agendamento: IAgendamento | null;
  onFinalizar?: (descricao: string, duracaoMinutos?: number) => Promise<void>;
}

const formatarTempo = (segundos: number): string => {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segs = segundos % 60;

  if (horas > 0) {
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
  }
  return `${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
};

const estadosBrasileiros = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const generos = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'];

export const ProntuarioModal: React.FC<Props> = ({ open, onClose, agendamento, onFinalizar }) => {
  const { user } = useAuth();
  const isDoutor = user?.role === 'DOUTOR';
  
  const [activeTab, setActiveTab] = useState<number>(0);
  const [atendimentoIniciado, setAtendimentoIniciado] = useState(false);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [inicioAtendimento, setInicioAtendimento] = useState<Date | null>(null);
  const [descricaoFinalizacao, setDescricaoFinalizacao] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const [openModalFinalizar, setOpenModalFinalizar] = useState(false);
  const [historicos, setHistoricos] = useState<IHistoricoPaciente[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [historicoError, setHistoricoError] = useState<string | null>(null);
  const [filtroData, setFiltroData] = useState<string>('');
  const [filtroPrescricao, setFiltroPrescricao] = useState<string>('');
  const [filtroDescricao, setFiltroDescricao] = useState<string>('');
  const [openModalHistorico, setOpenModalHistorico] = useState(false);
  const [historicoSelecionado, setHistoricoSelecionado] = useState<IHistoricoPaciente | null>(null);
  const [descricaoEditando, setDescricaoEditando] = useState<string>('');
  const [salvandoHistorico, setSalvandoHistorico] = useState(false);
  const [pacienteData, setPacienteData] = useState<Partial<IPaciente>>({});
  const [salvandoPaciente, setSalvandoPaciente] = useState(false);
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [chatMessages, setChatMessages] = useState<IProntuarioChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [geminiTyping, setGeminiTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [initialChatLoaded, setInitialChatLoaded] = useState(false);
  const [displayedChatText, setDisplayedChatText] = useState<Record<number, string>>({});
  const displayedChatTextRef = useRef<Record<number, string>>({});
  const typingFrameRefs = useRef<Record<number, number>>({});
  const typingTimeoutRef = useRef<number | null>(null);
  const [alergiasList, setAlergiasList] = useState<string[]>([]);
  const [novaAlergia, setNovaAlergia] = useState<string>('');
  const intervalRef = useRef<number | null>(null);
  
  // Estados para prescrição
  const [openPrescricaoModal, setOpenPrescricaoModal] = useState(false);
  const [textoPrescricao, setTextoPrescricao] = useState('');
  const [doutorAtual, setDoutorAtual] = useState<IDoutor | null>(null);
  const [prescricoes, setPrescricoes] = useState<IPrescricao[]>([]);
  const [loadingPrescricoes, setLoadingPrescricoes] = useState(false);
  const [prescricoesError, setPrescricoesError] = useState<string | null>(null);

  const duracaoEsperadaMin = agendamento?.servico.duracaoMin || 0;
  const duracaoEsperadaSeg = duracaoEsperadaMin * 60;

  // Parse de alergias
  const parseAlergias = (alergias: string | null | undefined): string[] => {
    if (!alergias || alergias.trim() === '') return [];
    return alergias
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
  };

  const alergias = agendamento ? parseAlergias(agendamento.paciente.alergias) : [];

  const markdownComponents = useMemo<ReactMarkdownComponents>(() => ({
    p: ({ node, ...props }) => (
      <Typography
        variant="body2"
        sx={{ mb: 1, '&:last-child': { mb: 0 } }}
        {...props}
      />
    ),
    strong: ({ node, ...props }) => (
      <Typography component="span" sx={{ fontWeight: 600 }} {...props} />
    ),
    em: ({ node, ...props }) => (
      <Typography component="span" sx={{ fontStyle: 'italic' }} {...props} />
    ),
    ul: ({ node, ...props }) => (
      <Box component="ul" sx={{ pl: 2.5, mb: 1 }} {...props} />
    ),
    ol: ({ node, ...props }) => (
      <Box component="ol" sx={{ pl: 2.5, mb: 1 }} {...props} />
    ),
    li: ({ node, ...props }) => (
      <Typography component="li" variant="body2" sx={{ mb: 0.5 }} {...props} />
    ),
    code: ({ node, ...props }) => (
      <Box
        component="code"
        sx={{
          display: 'inline-block',
          bgcolor: 'grey.900',
          color: 'common.white',
          px: 0.5,
          borderRadius: 0.5,
          fontSize: '0.85rem',
        }}
        {...props}
      />
    ),
    blockquote: ({ node, ...props }) => (
      <Box
        component="blockquote"
        sx={{
          borderLeft: '4px solid rgba(0,0,0,0.12)',
          pl: 2,
          my: 1,
          color: 'text.secondary',
          fontStyle: 'italic',
        }}
        {...props}
      />
    ),
  }), []);

  // Componente memoizado para mensagens do chat para evitar re-renderizações desnecessárias
  const ChatMessage = memo(({ message, renderedContent, isDoctor }: { message: IProntuarioChatMessage; renderedContent: string; isDoctor: boolean }) => {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: isDoctor ? 'flex-end' : 'flex-start',
        }}
      >
        <Box
          sx={{
            maxWidth: '80%',
            bgcolor: isDoctor ? 'primary.main' : 'grey.100',
            color: isDoctor ? 'primary.contrastText' : 'text.primary',
            px: 1.5,
            py: 1,
            borderRadius: 2,
            boxShadow: 1,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            overflow: 'hidden',
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}
            color={isDoctor ? 'primary.contrastText' : 'text.secondary'}
          >
            {isDoctor ? 'Você' : 'Simpatia'}
          </Typography>
          <Box
            sx={{
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              '& p': {
                margin: 0,
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              },
              '& pre': {
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                maxWidth: '100%',
                overflow: 'auto',
              },
              '& code': {
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                whiteSpace: 'pre-wrap',
              },
            }}
          >
            <ReactMarkdown components={markdownComponents}>
              {renderedContent}
            </ReactMarkdown>
          </Box>
          <Typography
            variant="caption"
            sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}
            color={isDoctor ? 'primary.contrastText' : 'text.secondary'}
          >
            {moment(message.createdAt).format('DD/MM/YYYY HH:mm')}
          </Typography>
        </Box>
      </Box>
    );
  }, (prevProps, nextProps) => {
    // Só re-renderiza se o conteúdo mudou
    return prevProps.renderedContent === nextProps.renderedContent && 
           prevProps.message.id === nextProps.message.id;
  });

  ChatMessage.displayName = 'ChatMessage';

  // Iniciar/parar timer
  useEffect(() => {
    if (atendimentoIniciado && inicioAtendimento) {
      intervalRef.current = window.setInterval(() => {
        const agora = new Date();
        const decorrido = Math.floor((agora.getTime() - inicioAtendimento.getTime()) / 1000);
        setTempoDecorrido(decorrido);
      }, 1000);
    } else {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [atendimentoIniciado, inicioAtendimento]);

  // Resetar quando o modal fechar ou mudar o agendamento
  useEffect(() => {
    if (!open) {
      setAtendimentoIniciado(false);
      setTempoDecorrido(0);
      setInicioAtendimento(null);
      setDescricaoFinalizacao('');
      setActiveTab(0);
      setHistoricos([]);
      setHistoricoError(null);
      setFiltroData('');
      setFiltroPrescricao('');
      setFiltroDescricao('');
      setOpenModalFinalizar(false);
      setChatMessages([]);
      setChatInput('');
      setChatError(null);
      setInitialChatLoaded(false);
      setDisplayedChatText({});
      displayedChatTextRef.current = {};
      Object.values(typingFrameRefs.current).forEach((frameId) => {
        if (frameId) {
          cancelAnimationFrame(frameId);
        }
      });
      typingFrameRefs.current = {};
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    if (open && agendamento?.id) {
      carregarChatGemini(agendamento.id, true);
    }
  }, [open, agendamento?.id]);

  useEffect(() => {
    // Usar requestAnimationFrame com debounce para evitar forced reflow
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const scrollToBottom = () => {
      if (chatContainerRef.current) {
        rafId = requestAnimationFrame(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
          rafId = null;
        });
      }
    };
    
    // Debounce de 50ms para evitar múltiplos scrolls
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(scrollToBottom, 50);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [chatMessages]);

  useEffect(() => {
    displayedChatTextRef.current = displayedChatText;
  }, [displayedChatText]);

  useEffect(() => {
    return () => {
      Object.values(typingFrameRefs.current).forEach((frameId) => {
        if (frameId) {
          cancelAnimationFrame(frameId);
        }
      });
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    chatMessages.forEach((message) => {
      if (displayedChatTextRef.current[message.id]) {
        return;
      }

      if (message.sender === 'IA' && initialChatLoaded) {
        setDisplayedChatText((prev) => ({
          ...prev,
          [message.id]: '',
        }));

        const totalDuration = Math.max(400, Math.min(900, message.content.length * 8));
        const startTime = performance.now();

        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(1, elapsed / totalDuration);
          const charsToShow = Math.max(1, Math.floor(progress * message.content.length));

          setDisplayedChatText((prev) => ({
            ...prev,
            [message.id]: message.content.slice(0, charsToShow),
          }));

          if (progress < 1) {
            typingFrameRefs.current[message.id] = requestAnimationFrame(animate);
          } else {
            delete typingFrameRefs.current[message.id];
          }
        };

        typingFrameRefs.current[message.id] = requestAnimationFrame(animate);
      } else {
        setDisplayedChatText((prev) => ({
          ...prev,
          [message.id]: message.content,
        }));
      }
    });
  }, [chatMessages, initialChatLoaded]);

  const carregarChatGemini = async (agendamentoId: number, skipAnimation = false) => {
    try {
      setChatLoading(true);
      setChatError(null);
      const data = await getProntuarioChatMessages(agendamentoId);
      if (skipAnimation) {
        setDisplayedChatText((prev) => {
          const next = { ...prev };
          data.forEach((message) => {
            next[message.id] = message.content;
          });
          return next;
        });
        setInitialChatLoaded(true);
      } else {
        setInitialChatLoaded(true);
      }
      setChatMessages(data);
    } catch (error: any) {
      setChatError(error?.response?.data?.message || 'Não foi possível carregar o chat da IA.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleEnviarMensagemIA = async () => {
    if (!agendamento || !chatInput.trim()) {
      return;
    }

    try {
      setSendingChat(true);
      setGeminiTyping(true);
      const response = await sendProntuarioChatMessage(agendamento.id, chatInput.trim());
      setChatInput('');
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = window.setTimeout(() => {
        setChatMessages(response.messages);
        setGeminiTyping(false);
        typingTimeoutRef.current = null;
      }, 1000);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Não foi possível enviar a mensagem.');
      setGeminiTyping(false);
    } finally {
      setSendingChat(false);
    }
  };


  // Carregar histórico quando a aba de histórico for selecionada
  useEffect(() => {
    if (open && activeTab === 1 && agendamento?.paciente.id) {
      const carregarHistorico = async () => {
        try {
          setLoadingHistorico(true);
          setHistoricoError(null);
          const data = await getPacienteHistoricos(agendamento.paciente.id);
          setHistoricos(data);
        } catch (err: any) {
          setHistoricoError(err?.response?.data?.message ?? 'Não foi possível carregar o histórico.');
        } finally {
          setLoadingHistorico(false);
        }
      };
      carregarHistorico();
    }
  }, [open, activeTab, agendamento?.paciente.id]);

  // Carregar prescrições quando a aba de prescrições for selecionada
  useEffect(() => {
    if (open && activeTab === 3 && agendamento?.paciente.id) {
      const carregarPrescricoes = async () => {
        try {
          setLoadingPrescricoes(true);
          setPrescricoesError(null);
          const data = await getPrescricoesPaciente(agendamento.paciente.id);
          setPrescricoes(data);
        } catch (err: any) {
          setPrescricoesError(err?.response?.data?.message ?? 'Não foi possível carregar as prescrições.');
        } finally {
          setLoadingPrescricoes(false);
        }
      };
      carregarPrescricoes();
    }
  }, [open, activeTab, agendamento?.paciente.id]);

  // Carregar dados do paciente quando a aba de dados for selecionada
  useEffect(() => {
    if (open && activeTab === 2 && agendamento?.paciente) {
      const paciente = agendamento.paciente;
      const alergiasParsed = parseAlergias(paciente.alergias || '');
      setAlergiasList(alergiasParsed);
      setNovaAlergia('');
      setPacienteData({
        nome: paciente.nome || '',
        telefone: paciente.telefone || '',
        cpf: paciente.cpf || '',
        dataNascimento: paciente.dataNascimento
          ? moment(paciente.dataNascimento).format('YYYY-MM-DD')
          : '',
        genero: paciente.genero || '',
        email: paciente.email || '',
        cep: paciente.cep || '',
        logradouro: paciente.logradouro || '',
        numero: paciente.numero || '',
        bairro: paciente.bairro || '',
        cidade: paciente.cidade || '',
        estado: paciente.estado || '',
        convenio: paciente.convenio || '',
        numeroCarteirinha: paciente.numeroCarteirinha || '',
        alergias: formatAlergias(alergiasParsed),
        observacoes: paciente.observacoes || '',
        doutorId: paciente.doutorId || undefined,
        pesoKg: paciente.pesoKg ?? undefined,
        alturaCm: paciente.alturaCm ?? undefined,
      });

      // Carregar doutores se não for DOUTOR
      if (!isDoutor) {
        const carregarDoutores = async () => {
          try {
            const data = await getDoutores();
            setDoutores(data);
          } catch (error: any) {
            console.error('Erro ao carregar doutores:', error);
          }
        };
        carregarDoutores();
      }
    }
  }, [open, activeTab, agendamento?.paciente, isDoutor]);

  const handleIniciarAtendimento = () => {
    setAtendimentoIniciado(true);
    setInicioAtendimento(new Date());
    toast.success('Atendimento iniciado!');
  };

  const handlePausarAtendimento = () => {
    setAtendimentoIniciado(false);
    toast.info('Atendimento pausado');
  };

  const handleRetomarAtendimento = () => {
    if (inicioAtendimento) {
      // Ajustar o início para compensar o tempo já decorrido
      const agora = new Date();
      const novoInicio = new Date(agora.getTime() - tempoDecorrido * 1000);
      setInicioAtendimento(novoInicio);
    } else {
      setInicioAtendimento(new Date());
    }
    setAtendimentoIniciado(true);
    toast.success('Atendimento retomado!');
  };

  const handleAbrirModalFinalizar = () => {
    setOpenModalFinalizar(true);
  };

  const handleFecharModalFinalizar = () => {
    setOpenModalFinalizar(false);
    setDescricaoFinalizacao('');
  };

  const handleFinalizarConsulta = async () => {
    if (!descricaoFinalizacao.trim()) {
      toast.error('Por favor, preencha a descrição da consulta');
      return;
    }

    if (!onFinalizar) {
      toast.error('Função de finalização não disponível');
      return;
    }

    // Verificar se o atendimento foi iniciado
    if (!atendimentoIniciado && !inicioAtendimento) {
      toast.error('É necessário iniciar o atendimento antes de finalizá-lo');
      return;
    }

    try {
      setFinalizando(true);
      // Calcular duração em minutos (arredondado)
      const duracaoMinutos = inicioAtendimento 
        ? Math.round(tempoDecorrido / 60) 
        : undefined;
      
      await onFinalizar(descricaoFinalizacao, duracaoMinutos);
      // Não mostrar toast aqui, pois o onFinalizar já mostra
      setAtendimentoIniciado(false);
      setTempoDecorrido(0);
      setInicioAtendimento(null);
      setDescricaoFinalizacao('');
      setOpenModalFinalizar(false);
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Erro ao finalizar consulta');
    } finally {
      setFinalizando(false);
    }
  };

  // Função para converter array de alergias em string
  const formatAlergias = (alergias: string[]): string => {
    return alergias.join(', ');
  };

  const handleAbrirModalHistorico = (historico: IHistoricoPaciente) => {
    setHistoricoSelecionado(historico);
    setDescricaoEditando(historico.descricao);
    setOpenModalHistorico(true);
  };

  const handleFecharModalHistorico = () => {
    setHistoricoSelecionado(null);
    setDescricaoEditando('');
    setOpenModalHistorico(false);
  };

  const handleSalvarHistorico = async () => {
    if (!historicoSelecionado || !descricaoEditando.trim()) {
      toast.error('A descrição não pode estar vazia');
      return;
    }

    try {
      setSalvandoHistorico(true);
      await updateHistoricoPaciente(historicoSelecionado.id, descricaoEditando);
      toast.success('Descrição do atendimento atualizada com sucesso!');
      
      // Atualizar o histórico na lista
      setHistoricos(historicos.map(h => 
        h.id === historicoSelecionado.id 
          ? { ...h, descricao: descricaoEditando }
          : h
      ));
      
      handleFecharModalHistorico();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Erro ao atualizar descrição do atendimento');
    } finally {
      setSalvandoHistorico(false);
    }
  };

  // Função para formatar CPF para exibição
  const formatarCPFExibicao = (cpf: string) => {
    if (!cpf) return '';
    const apenasNumeros = cpf.replace(/\D/g, '');
    if (apenasNumeros.length <= 11) {
      return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  };

  // Função para formatar CEP para exibição
  const formatarCEPExibicao = (cep: string) => {
    if (!cep) return '';
    const apenasNumeros = cep.replace(/\D/g, '');
    if (apenasNumeros.length <= 8) {
      return apenasNumeros.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    return cep;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPacienteData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
      setPacienteData((prev) => ({ ...prev, cpf: value }));
    }
  };

  const handleCEPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 8) {
      setPacienteData((prev) => ({ ...prev, cep: value }));
    }
  };

  const handleGeneroChange = (e: any) => {
    setPacienteData((prev) => ({ ...prev, genero: e.target.value }));
  };

  const handleEstadoChange = (e: any) => {
    setPacienteData((prev) => ({ ...prev, estado: e.target.value }));
  };

  const handleDoutorChange = (e: any) => {
    const value = e.target.value;
    setPacienteData((prev) => ({ ...prev, doutorId: value === '' ? undefined : Number(value) }));
  };

  const handleAddAlergia = () => {
    const alergiaTrimmed = novaAlergia.trim();
    if (alergiaTrimmed && !alergiasList.includes(alergiaTrimmed)) {
      const novasAlergias = [...alergiasList, alergiaTrimmed];
      setAlergiasList(novasAlergias);
      setPacienteData((prev) => ({ ...prev, alergias: formatAlergias(novasAlergias) }));
      setNovaAlergia('');
    }
  };

  const handleRemoveAlergia = (alergiaToRemove: string) => {
    const novasAlergias = alergiasList.filter((a) => a !== alergiaToRemove);
    setAlergiasList(novasAlergias);
    setPacienteData((prev) => ({ ...prev, alergias: formatAlergias(novasAlergias) }));
  };

  const handleKeyPressAlergia = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAlergia();
    }
  };

  const handleSalvarPaciente = async () => {
    if (!agendamento?.paciente.id) return;

    try {
      setSalvandoPaciente(true);
      const dataToSave = {
        ...pacienteData,
        cpf: pacienteData.cpf ? pacienteData.cpf.replace(/\D/g, '') : '',
        cep: pacienteData.cep ? pacienteData.cep.replace(/\D/g, '') : '',
        alergias: formatAlergias(alergiasList),
        pesoKg: pacienteData.pesoKg ?? null,
        alturaCm: pacienteData.alturaCm ?? null,
      };
      await updatePaciente(agendamento.paciente.id, dataToSave);
      toast.success('Dados do paciente atualizados com sucesso!');
      // Atualizar os dados do agendamento para refletir as mudanças
      if (agendamento) {
        Object.assign(agendamento.paciente, dataToSave);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Erro ao salvar dados do paciente');
    } finally {
      setSalvandoPaciente(false);
    }
  };

  const handleVisualizarPrescricao = async (prescricaoProtocolo: string) => {
    try {
      // Buscar prescrição completa pelo protocolo
      const prescricao = await getPrescricaoByProtocolo(prescricaoProtocolo);
      
      if (!prescricao) {
        toast.error('Prescrição não encontrada');
        return;
      }

      if (!prescricao.paciente) {
        toast.error('Dados do paciente não encontrados');
        return;
      }

      // Carregar modelo do doutor ou usar padrão
      let modeloPrescricao: IModeloPrescricaoPDF = modeloPrescricaoPadrao;
      let logoURL = '';
      
      const modeloStr = prescricao.doutor.modeloPrescricao || '';
      if (modeloStr) {
        try {
          const modeloCarregado = JSON.parse(modeloStr) as IModeloPrescricaoPDF;
          modeloPrescricao = {
            ...modeloPrescricaoPadrao,
            ...modeloCarregado,
            logoWatermark: {
              ...modeloPrescricaoPadrao.logoWatermark,
              ...(modeloCarregado.logoWatermark || {}),
            },
            header: {
              ...modeloPrescricaoPadrao.header,
              ...(modeloCarregado.header || {}),
            },
            medicoInfo: {
              ...modeloPrescricaoPadrao.medicoInfo,
              ...(modeloCarregado.medicoInfo || {}),
            },
            pacienteInfo: {
              ...modeloPrescricaoPadrao.pacienteInfo,
              ...(modeloCarregado.pacienteInfo || {}),
              showCPF: true,
              showEndereco: true,
            },
            prescricao: {
              ...modeloPrescricaoPadrao.prescricao,
              ...(modeloCarregado.prescricao || {}),
            },
            assinatura: {
              ...modeloPrescricaoPadrao.assinatura,
              ...(modeloCarregado.assinatura || {}),
            },
            footer: {
              ...modeloPrescricaoPadrao.footer,
              ...(modeloCarregado.footer || {}),
            },
          };
          logoURL = modeloPrescricao.logoUrl || '';
        } catch (error) {
          console.warn('Modelo de prescrição não é JSON válido, usando padrão:', error);
          modeloPrescricao = modeloPrescricaoPadrao;
          logoURL = '';
        }
      }
      
      // Montar endereço do paciente
      const enderecoPaciente = [
        prescricao.paciente.logradouro,
        prescricao.paciente.numero,
        prescricao.paciente.bairro,
        prescricao.paciente.cidade,
        prescricao.paciente.estado
      ].filter(Boolean).join(', ') || '';
      
      // Separar texto da prescrição em linhas
      const itensPrescricao = prescricao.conteudo.split('\n').filter(line => line.trim());
      
      // Obter dados da clínica
      const clinicaNome = prescricao.doutor.clinica?.nome || 'Clínica';
      const clinicaEndereco = prescricao.doutor.clinica?.endereco || '';
      const clinicaTelefone = prescricao.doutor.clinica?.telefone || '';
      const clinicaEmail = prescricao.doutor.clinica?.email || '';
      const clinicaSite = prescricao.doutor.clinica?.site || '';
      const clinicaCNPJ = prescricao.doutor.clinica?.cnpj;

      // Gerar PDF
      const pdfDoc = (
        <PrescricaoPdfView
          pacienteNome={prescricao.paciente.nome || ''}
          pacienteEndereco={enderecoPaciente}
          pacienteCPF={prescricao.paciente.cpf || undefined}
          data={moment(prescricao.createdAt).format('YYYY-MM-DD')}
          seguroSaude={prescricao.paciente.convenio || ''}
          diagnostico=""
          doutorNome={prescricao.doutor.nome || ''}
          doutorEspecialidade={prescricao.doutor.especialidade || ''}
          doutorTagline={modeloPrescricao.medicoInfo.tagline || ''}
          doutorCRM={prescricao.doutor.crm}
          doutorCRMUF={prescricao.doutor.crmUf}
          doutorRQE={prescricao.doutor.rqe}
          itensPrescricao={itensPrescricao}
          clinicaNome={clinicaNome}
          clinicaEndereco={clinicaEndereco}
          clinicaTelefone={clinicaTelefone}
          clinicaEmail={clinicaEmail}
          clinicaSite={clinicaSite}
          clinicaCNPJ={clinicaCNPJ}
          clinicaLogoUrl={logoURL}
          modelo={modeloPrescricao}
          isControleEspecial={false}
        />
      );

      // Gerar blob do PDF e abrir para impressão
      pdf(pdfDoc).toBlob().then((blob) => {
        if (blob.size === 0) {
          toast.error('Erro: PDF gerado está vazio');
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
              toast.success('Prescrição carregada com sucesso!');
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 250);
          };
          
          printWindow.onerror = () => {
            toast.error('Erro ao abrir janela de impressão');
          };
        } else {
          toast.error('Não foi possível abrir a janela de impressão. Verifique se o pop-up está bloqueado.');
        }
      }).catch((error) => {
        console.error('Erro ao gerar PDF:', error);
        toast.error(`Erro ao gerar prescrição: ${error.message || 'Erro desconhecido'}`);
      });
    } catch (error: any) {
      console.error('Erro ao visualizar prescrição:', error);
      toast.error(`Erro: ${error.message || 'Erro desconhecido ao visualizar prescrição'}`);
    }
  };

  if (!agendamento) return null;

  const porcentagemTempo = duracaoEsperadaSeg > 0 ? Math.min((tempoDecorrido / duracaoEsperadaSeg) * 100, 100) : 0;
  const tempoExcedido = tempoDecorrido > duracaoEsperadaSeg;
  const tempoFormatado = formatarTempo(tempoDecorrido);
  const dataNascimentoPaciente = agendamento.paciente.dataNascimento ? moment(agendamento.paciente.dataNascimento) : null;
  const idadePaciente = dataNascimentoPaciente ? moment().diff(dataNascimentoPaciente, 'years') : null;
  const pesoPaciente = agendamento.paciente.pesoKg ?? null;
  const alturaPaciente = agendamento.paciente.alturaCm ?? null;
  const imcPaciente =
    pesoPaciente && alturaPaciente && alturaPaciente > 0
      ? pesoPaciente / Math.pow(alturaPaciente / 100, 2)
      : null;

  return (
    <>
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xl" 
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '85vh',
          maxHeight: '95vh',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ flexShrink: 0 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box flex={1} display="flex" alignItems="center" gap={3}>
            <Typography variant="h5" fontWeight="bold">
              Prontuário do Paciente
            </Typography>
            
            {/* Timer de Atendimento */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1,
                borderRadius: 2,
                border: '1px solid',
                borderColor: tempoExcedido ? 'error.light' : 'grey.300',
                bgcolor: tempoExcedido ? 'error.lighter' : 'grey.50',
              }}
            >
              <AccessTimeIcon 
                fontSize="small" 
                sx={{ color: tempoExcedido ? 'error.main' : 'text.secondary' }}
              />
              <Box>
                <Typography 
                  variant="body2" 
                  fontWeight="bold"
                  color={tempoExcedido ? 'error.main' : 'text.primary'}
                >
                  {tempoFormatado}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {!atendimentoIniciado && !inicioAtendimento && (
                  <Tooltip title="Iniciar atendimento">
                    <span>
                      <IconButton
                        color="success"
                        onClick={handleIniciarAtendimento}
                        disabled={agendamento.status === 'finalizado'}
                        size="small"
                        sx={{ p: 0.5 }}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}

                {atendimentoIniciado && (
                  <Tooltip title="Pausar atendimento">
                    <IconButton 
                      color="warning" 
                      onClick={handlePausarAtendimento} 
                      size="small"
                      sx={{ p: 0.5 }}
                    >
                      <StopIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}

                {!atendimentoIniciado && inicioAtendimento && (
                  <Tooltip title="Retomar atendimento">
                    <span>
                      <IconButton
                        color="success"
                        onClick={handleRetomarAtendimento}
                        disabled={agendamento.status === 'finalizado'}
                        size="small"
                        sx={{ p: 0.5 }}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Box>
              <LinearProgress
                variant="determinate"
                value={porcentagemTempo}
                color={tempoExcedido ? 'error' : 'primary'}
                sx={{ 
                  width: 80, 
                  height: 4, 
                  borderRadius: 2,
                }}
              />
              <Chip
                label={`${porcentagemTempo.toFixed(0)}%`}
                size="small"
                color={tempoExcedido ? 'error' : 'primary'}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mt: 2 }}>
          <Tab label="Prontuário" />
          <Tab label="Histórico de Atendimentos" />
          <Tab label="Dados do Paciente" />
          <Tab label="Prescrições" />
        </Tabs>
      </DialogTitle>
      <DialogContent 
        dividers
        sx={{
          flex: 1,
          overflow: activeTab === 0 || activeTab === 1 || activeTab === 3 ? 'hidden' : 'auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          p: activeTab === 0 ? 2 : 3,
        }}
      >
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          <Grid container spacing={3} sx={{ flex: 1, minHeight: 0, height: '100%', width: '100%' }}>
          {/* Informações do Paciente */}
          <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
            <Card 
              elevation={2}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
              }}
            >
              <CardContent sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, p: 2 }}>
                <Stack spacing={2} mb={2}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                        <PersonIcon sx={{ fontSize: 24 }} />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" fontWeight="bold">
                          {agendamento.paciente.nome}
                        </Typography>
                        <Chip
                          label={agendamento.status === 'finalizado' ? 'Finalizado' : 'Em Atendimento'}
                          color={agendamento.status === 'finalizado' ? 'success' : 'primary'}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    </Stack>

                    <Button
                      variant="contained"
                      size="medium"
                      startIcon={<DescriptionIcon />}
                      onClick={async () => {
                          console.log('Botão Prescrições clicado');
                          console.log('Agendamento:', agendamento);
                          console.log('Doutores carregados:', doutores.length);
                          
                          // Se não tiver doutores carregados, buscar
                          if (doutores.length === 0) {
                            try {
                              console.log('Carregando doutores...');
                              const data = await getDoutores();
                              console.log('Doutores carregados:', data);
                              setDoutores(data);
                              const doutor = data.find(d => d.id === agendamento.doutor.id);
                              if (doutor) {
                                console.log('Doutor encontrado:', doutor);
                                setDoutorAtual(doutor);
                              } else {
                                console.log('Doutor não encontrado na lista, usando do agendamento');
                                setDoutorAtual(agendamento.doutor as IDoutor);
                              }
                            } catch (error) {
                              console.error('Erro ao carregar doutores:', error);
                              setDoutorAtual(agendamento.doutor as IDoutor);
                            }
                          } else {
                            // Buscar dados do doutor atual na lista
                            const doutor = doutores.find(d => d.id === agendamento.doutor.id);
                            if (doutor) {
                              console.log('Doutor encontrado na lista:', doutor);
                              setDoutorAtual(doutor);
                            } else {
                              // Se não encontrou na lista, usar o doutor do agendamento
                              console.log('Doutor não encontrado na lista, usando do agendamento');
                              setDoutorAtual(agendamento.doutor as IDoutor);
                            }
                          }
                          console.log('Abrindo modal de prescrição');
                          setOpenPrescricaoModal(true);
                        }}
                        sx={{ 
                          minWidth: 140,
                          boxShadow: 2,
                          '&:hover': {
                            boxShadow: 4,
                          }
                        }}
                      >
                        Prescrição
                      </Button>
                  </Stack>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Grid container spacing={1.5} sx={{ flexShrink: 0, mb: 1 }}>
                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'grey.200',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Idade
                      </Typography>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {idadePaciente !== null ? `${idadePaciente} anos` : 'Não informado'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'grey.200',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Sexo
                      </Typography>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {agendamento.paciente.genero || 'Não informado'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'grey.200',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Peso
                      </Typography>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {pesoPaciente !== null ? `${pesoPaciente.toFixed(1)} kg` : 'Não informado'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'grey.200',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        IMC
                      </Typography>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {imcPaciente !== null ? imcPaciente.toFixed(1) : 'Não calculado'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 1.5 }} />

                <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneIcon color="action" sx={{ fontSize: 18 }} />
                    <Typography variant="body2">{agendamento.paciente.telefone}</Typography>
                  </Stack>

                  {agendamento.paciente.email && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <EmailIcon color="action" sx={{ fontSize: 18 }} />
                      <Typography variant="body2">{agendamento.paciente.email}</Typography>
                    </Stack>
                  )}

                  <Stack direction="row" spacing={1} alignItems="center">
                    <AccessTimeIcon color="action" sx={{ fontSize: 18 }} />
                    <Typography variant="body2">
                      {moment(agendamento.dataHora).format('DD/MM/YYYY [às] HH:mm')}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <MedicalServicesIcon color="action" sx={{ fontSize: 18 }} />
                    <Typography variant="body2">
                      {agendamento.servico.nome} ({agendamento.servico.duracaoMin} min)
                    </Typography>
                  </Stack>
                </Stack>

                <Box sx={{ mt: 1.5, flexShrink: 0 }}>
                  <Divider sx={{ my: 1.5 }} />
                  {alergias.length > 0 ? (
                    <Alert severity="error" icon={<WarningIcon />} sx={{ py: 0.5 }}>
                      <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                        ALERTA: Alergias Conhecidas
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {alergias.map((alergia, idx) => (
                          <Chip key={idx} label={alergia} color="error" size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                        ))}
                      </Box>
                    </Alert>
                  ) : (
                    <Alert 
                      severity="info" 
                      icon={<WarningIcon />} 
                      sx={{ 
                        py: 0.5,
                        backgroundColor: 'grey.100',
                        color: 'grey.700',
                        '& .MuiAlert-icon': {
                          color: 'grey.600',
                        },
                      }}
                    >
                      <Typography variant="caption" fontWeight="bold" display="block" sx={{ color: 'grey.700' }}>
                        ALERTA: Nenhuma
                      </Typography>
                    </Alert>
                  )}
                </Box>

                {agendamento.paciente.observacoes && (
                  <Box sx={{ mt: 1.5, flexShrink: 0 }}>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                      Observações
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {agendamento.paciente.observacoes}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Simpatia */}
          <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
            <Card
              elevation={2}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
              }}
            >
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      Simpatia
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Olá dr. estou aqui para lhe auxiliar sobre este atendimento.
                    </Typography>
                  </Box>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Box
                  ref={chatContainerRef}
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pr: 1,
                    mb: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    willChange: 'scroll-position',
                    contain: 'layout style paint',
                  }}
                >
                  {chatLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : chatMessages.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma mensagem registrada ainda. Envie a primeira pergunta para a Simpatia.
                    </Typography>
                  ) : (
                    chatMessages.map((message) => {
                      const isDoctor = message.sender === 'DOUTOR';
                      const renderedContent = displayedChatText[message.id] ?? message.content;

                      return (
                        <ChatMessage
                          key={message.id}
                          message={message}
                          renderedContent={renderedContent}
                          isDoctor={isDoctor}
                        />
                      );
                    })
                  )}
                  {geminiTyping && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <Box
                        sx={{
                          px: 1.5,
                          py: 0.75,
                          borderRadius: 2,
                          bgcolor: 'grey.100',
                          color: 'text.secondary',
                          fontStyle: 'italic',
                        }}
                      >
                        ...
                      </Box>
                    </Box>
                  )}
                </Box>

                {chatError && (
                  <Alert severity="error" sx={{ mb: 1.5 }}>
                    {chatError}
                  </Alert>
                )}

                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Pergunte algo para a Simpatia"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    multiline
                    minRows={1}
                    maxRows={3}
                    fullWidth
                    inputProps={{
                      'data-testid': 'chat-input',
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleEnviarMensagemIA();
                      }
                    }}
                    InputProps={{
                      endAdornment: (
                        <Tooltip title="Enviar para o Gemini">
                          <span>
                            <IconButton
                              color="primary"
                              onClick={handleEnviarMensagemIA}
                              disabled={sendingChat || !chatInput.trim()}
                            >
                              <SendIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ),
                    }}
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Relato do Paciente (se houver) */}
          {agendamento.relatoPaciente && (
            <Grid item xs={12} sx={{ flexShrink: 0 }}>
              <Card elevation={1}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mb: 1 }}>
                    Relato do Paciente
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {agendamento.relatoPaciente}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}


        </Grid>
          </Box>
        )}

        {/* Aba de Histórico */}
        {activeTab === 1 && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {loadingHistorico ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : historicoError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {historicoError}
              </Alert>
            ) : (
              <>
                {/* Campos de Filtro */}
                <Box sx={{ mb: 1.5, pb: 1 }}>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Filtrar por Data"
                        type="date"
                        value={filtroData}
                        onChange={(e) => setFiltroData(e.target.value)}
                        fullWidth
                        size="small"
                        InputLabelProps={{
                          shrink: true,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Filtrar por Prescrição"
                        value={filtroPrescricao}
                        onChange={(e) => setFiltroPrescricao(e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="ID ou nome do medicamento"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Filtrar por Descrição do Atendimento"
                        value={filtroDescricao}
                        onChange={(e) => setFiltroDescricao(e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="ID, profissional ou corpo do atendimento"
                      />
                    </Grid>
                  </Grid>
                  {(filtroData || filtroPrescricao || filtroDescricao) && (
                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        onClick={() => {
                          setFiltroData('');
                          setFiltroPrescricao('');
                          setFiltroDescricao('');
                        }}
                      >
                        Limpar Filtros
                      </Button>
                    </Box>
                  )}
                </Box>

                {/* Lista de Históricos Filtrados */}
                {(() => {
                  // Aplicar filtros
                  const historicosFiltrados = historicos.filter((historico) => {
                    // Filtro por data
                    if (filtroData) {
                      const dataHistorico = moment(historico.realizadoEm).format('YYYY-MM-DD');
                      if (dataHistorico !== filtroData) {
                        return false;
                      }
                    }

                    // Filtro por prescrição
                    if (filtroPrescricao) {
                      const prescricoesHistorico = historico.prescricoes || historico.agendamento?.prescricoes || [];
                      const filtroLower = filtroPrescricao.toLowerCase();
                      const encontrouPrescricao = prescricoesHistorico.some((prescricao) => {
                        const idMatch = prescricao.id.toString().includes(filtroPrescricao);
                        const conteudoMatch = prescricao.conteudo?.toLowerCase().includes(filtroLower);
                        return idMatch || conteudoMatch;
                      });
                      if (!encontrouPrescricao) {
                        return false;
                      }
                    }

                    // Filtro por descrição do atendimento, ID do histórico e profissional
                    if (filtroDescricao) {
                      const descricaoLower = historico.descricao.toLowerCase();
                      const filtroLower = filtroDescricao.toLowerCase();
                      const idMatch = historico.id.toString().includes(filtroDescricao);
                      const descricaoMatch = descricaoLower.includes(filtroLower);
                      const profissionalMatch = historico.doutor?.nome?.toLowerCase().includes(filtroLower) || false;
                      if (!idMatch && !descricaoMatch && !profissionalMatch) {
                        return false;
                      }
                    }

                    return true;
                  });

                  if (historicosFiltrados.length === 0) {
                    return (
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <Typography variant="body1" color="text.secondary">
                          Nenhum histórico encontrado com os filtros aplicados.
                        </Typography>
                      </Box>
                    );
                  }

                  return (
                    <List sx={{ flex: 1, overflowY: 'auto' }}>
                      {historicosFiltrados.map((historico, index) => {
                  const realizadoEm = moment(historico.realizadoEm);
                  const realizadoLabel = `${realizadoEm.format('DD/MM/YYYY')} às ${realizadoEm.format('HH:mm')}`;
                  const finalizadoEm = moment(historico.criadoEm);
                  const finalizadoLabel = finalizadoEm.isValid()
                    ? `${finalizadoEm.format('DD/MM/YYYY')} às ${finalizadoEm.format('HH:mm')}`
                    : null;
                  const servicoNome = historico.servico?.nome ?? 'Consulta';
                  const profissionalNome = historico.doutor?.nome
                    ? `Profissional: ${historico.doutor.nome}`
                    : null;

                  const prescricoesHistorico = historico.prescricoes || historico.agendamento?.prescricoes || [];
                  
                  // Função para extrair o primeiro medicamento do conteúdo
                  const extrairPrimeiroMedicamento = (conteudo: string): string => {
                    if (!conteudo) return '';
                    const linhas = conteudo.split('\n').filter(line => line.trim());
                    if (linhas.length === 0) return '';
                    const primeiraLinha = linhas[0].trim();
                    // Limitar a 30 caracteres e adicionar ... se necessário
                    return primeiraLinha.length > 30 ? primeiraLinha.substring(0, 30) + '...' : primeiraLinha;
                  };
                  
                  return (
                    <React.Fragment key={historico.id}>
                      <ListItem 
                        id={`historico-${historico.id}`}
                        alignItems="flex-start" 
                        disableGutters
                        sx={{
                          transition: 'background-color 0.3s ease',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ position: 'relative' }}>
                              {/* Marca d'água no canto superior direito */}
                              <Typography
                                variant="h4"
                                sx={{
                                  position: 'absolute',
                                  top: -10,
                                  right: 20,
                                  fontSize: '2rem',
                                  fontWeight: 'bold',
                                  color: 'rgba(0, 0, 0, 0.08)',
                                  zIndex: 0,
                                  pointerEvents: 'none',
                                  userSelect: 'none',
                                }}
                              >
                                #{historico.id}
                              </Typography>
                              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5} sx={{ position: 'relative', zIndex: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  {`${servicoNome} • ${realizadoLabel}`}
                                </Typography>
                              </Box>
                              {profissionalNome && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {profissionalNome}
                                </Typography>
                              )}
                              {finalizadoLabel && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {`Finalizado em ${finalizadoLabel}`}
                                  {historico.duracaoMinutos && (
                                    <span> • Duração: {historico.duracaoMinutos} min</span>
                                  )}
                                </Typography>
                              )}
                              {prescricoesHistorico.length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                    Prescrições Médicas:
                                  </Typography>
                                  {prescricoesHistorico.map((prescricao) => {
                                    const primeiroMedicamento = extrairPrimeiroMedicamento(prescricao.conteudo || '');
                                    const labelTexto = primeiroMedicamento 
                                      ? `#${prescricao.id} - ${primeiroMedicamento}`
                                      : `#${prescricao.id}`;
                                    
                                    return (
                                      <Tooltip
                                        key={prescricao.id}
                                        title={
                                          <Box component="div" sx={{ whiteSpace: 'pre-wrap', maxWidth: 400 }}>
                                            {prescricao.conteudo || 'Sem conteúdo'}
                                          </Box>
                                        }
                                        arrow
                                        enterDelay={1000}
                                        placement="top"
                                      >
                                        <Chip
                                          label={labelTexto}
                                          size="small"
                                          variant="outlined"
                                          color="success"
                                          onClick={() => handleVisualizarPrescricao(prescricao.protocolo)}
                                          sx={{ 
                                            mr: 0.5, 
                                            mb: 0.5,
                                            cursor: 'pointer',
                                            '&:hover': {
                                              backgroundColor: 'primary.light',
                                              color: 'primary.main',
                                              borderColor: 'primary.main',
                                            }
                                          }}
                                        />
                                      </Tooltip>
                                    );
                                  })}
                                </Box>
                              )}
                            </Box>
                          }
                          secondary={
                            <Tooltip 
                              title={historico.descricao}
                              arrow
                              enterDelay={500}
                              placement="top"
                            >
                              <Typography 
                                variant="body2" 
                                color="text.secondary" 
                                sx={{ 
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  cursor: 'pointer',
                                  mt: 1,
                                  '&:hover': {
                                    color: 'primary.main',
                                  }
                                }}
                                onClick={() => handleAbrirModalHistorico(historico)}
                              >
                                {historico.descricao}
                              </Typography>
                            </Tooltip>
                          }
                        />
                      </ListItem>
                      {index < historicosFiltrados.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  );
                })}
                    </List>
                  );
                })()}
              </>
            )}
          </Box>
        )}

        {/* Aba de Dados do Paciente */}
        {activeTab === 2 && (
          <Box>
            <Grid container spacing={3}>
              {/* Dados de Identificação */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 600 }}>
                  1. Dados de Identificação
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="nome"
                  label="Nome Completo"
                  value={pacienteData.nome || ''}
                  onChange={handleChange}
                  fullWidth
                  required
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="cpf"
                  label="CPF"
                  value={formatarCPFExibicao(pacienteData.cpf || '')}
                  onChange={handleCPFChange}
                  fullWidth
                  margin="normal"
                  placeholder="000.000.000-00"
                  inputProps={{ maxLength: 14 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  name="dataNascimento"
                  label="Data de Nascimento"
                  type="date"
                  value={pacienteData.dataNascimento || ''}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="genero-select-label">Gênero/Sexo Biológico</InputLabel>
                  <Select
                    labelId="genero-select-label"
                    id="genero-select"
                    value={pacienteData.genero || ''}
                    onChange={handleGeneroChange}
                    label="Gênero/Sexo Biológico"
                  >
                    <MenuItem value="">
                      <em>Selecione</em>
                    </MenuItem>
                    {generos.map((genero) => (
                      <MenuItem key={genero} value={genero}>
                        {genero}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  name="telefone"
                  label="Telefone (WhatsApp)"
                  value={pacienteData.telefone || ''}
                  onChange={handleChange}
                  fullWidth
                  required
                  margin="normal"
                  placeholder="14999998888"
                  helperText="Incluir DDI e DDD"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Peso (kg)"
                  type="number"
                  value={pacienteData.pesoKg ?? ''}
                  onChange={(e) =>
                    setPacienteData((prev) => ({
                      ...prev,
                      pesoKg: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                  fullWidth
                  margin="normal"
                  inputProps={{ step: '0.1', min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Altura (cm)"
                  type="number"
                  value={pacienteData.alturaCm ?? ''}
                  onChange={(e) =>
                    setPacienteData((prev) => ({
                      ...prev,
                      alturaCm: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                  fullWidth
                  margin="normal"
                  inputProps={{ step: '0.5', min: 0 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 3 }} />
              </Grid>

              {/* Dados de Contacto */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 600 }}>
                  2. Dados de Contacto
                </Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  name="email"
                  label="E-mail"
                  type="email"
                  value={pacienteData.email || ''}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  placeholder="exemplo@email.com"
                />
              </Grid>
              {!isDoutor && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel id="doutor-select-label">Doutor (Opcional)</InputLabel>
                    <Select
                      labelId="doutor-select-label"
                      id="doutor-select"
                      value={pacienteData.doutorId || ''}
                      onChange={handleDoutorChange}
                      label="Doutor (Opcional)"
                    >
                      <MenuItem value="">
                        <em>Nenhum</em>
                      </MenuItem>
                      {doutores.map((doutor) => (
                        <MenuItem key={doutor.id} value={doutor.id}>
                          {doutor.nome} {doutor.especialidade ? `- ${doutor.especialidade}` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={4}>
                <TextField
                  name="cep"
                  label="CEP"
                  value={formatarCEPExibicao(pacienteData.cep || '')}
                  onChange={handleCEPChange}
                  fullWidth
                  margin="normal"
                  placeholder="00000-000"
                  inputProps={{ maxLength: 9 }}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  name="logradouro"
                  label="Rua/Logradouro"
                  value={pacienteData.logradouro || ''}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  name="numero"
                  label="Número"
                  value={pacienteData.numero || ''}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  name="bairro"
                  label="Bairro"
                  value={pacienteData.bairro || ''}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  name="cidade"
                  label="Cidade"
                  value={pacienteData.cidade || ''}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="estado-select-label">Estado (UF)</InputLabel>
                  <Select
                    labelId="estado-select-label"
                    id="estado-select"
                    value={pacienteData.estado || ''}
                    onChange={handleEstadoChange}
                    label="Estado (UF)"
                  >
                    <MenuItem value="">
                      <em>Selecione</em>
                    </MenuItem>
                    {estadosBrasileiros.map((estado) => (
                      <MenuItem key={estado} value={estado}>
                        {estado}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 3 }} />
              </Grid>

              {/* Dados Clínicos Básicos */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 600 }}>
                  3. Dados Clínicos Básicos
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="convenio"
                  label="Convênio/Plano de Saúde"
                  value={pacienteData.convenio || ''}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  placeholder="Ex: Unimed, Bradesco, Particular"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="numeroCarteirinha"
                  label="Número da Carteirinha"
                  value={pacienteData.numeroCarteirinha || ''}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" sx={{ mb: 1, mt: 2, color: 'error.main', fontWeight: 500 }}>
                  Alergias (Campo crítico de alerta)
                </Typography>
                <TextField
                  label="Adicionar Alergia"
                  value={novaAlergia}
                  onChange={(e) => setNovaAlergia(e.target.value)}
                  fullWidth
                  margin="normal"
                  placeholder="Digite o nome da alergia (ex: Dipirona, Penicilina)"
                  onKeyPress={handleKeyPressAlergia}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleAddAlergia}
                          disabled={!novaAlergia.trim() || alergiasList.includes(novaAlergia.trim())}
                          edge="end"
                          color="primary"
                          size="small"
                        >
                          <AddIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                {alergiasList.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, mb: 1 }}>
                    {alergiasList.map((alergia, index) => (
                      <Chip
                        key={index}
                        label={alergia}
                        onDelete={() => handleRemoveAlergia(alergia)}
                        deleteIcon={<CloseIcon />}
                        color="error"
                        variant="outlined"
                        sx={{ fontSize: '0.875rem' }}
                      />
                    ))}
                  </Box>
                )}
                {alergiasList.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                    Nenhuma alergia cadastrada. Use o campo acima para adicionar alergias.
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="observacoes"
                  label="Histórico/Observações"
                  value={pacienteData.observacoes || ''}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  multiline
                  rows={3}
                  placeholder="Ex: Paciente prefere contato à tarde, histórico de..."
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, mb: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSalvarPaciente}
                    disabled={salvandoPaciente}
                    startIcon={salvandoPaciente ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                  >
                    {salvandoPaciente ? 'Salvando...' : 'Salvar Dados'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Aba de Prescrições */}
        {activeTab === 3 && (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            {loadingPrescricoes ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                <CircularProgress />
              </Box>
            ) : prescricoesError ? (
              <Alert severity="error">{prescricoesError}</Alert>
            ) : prescricoes.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  Nenhuma prescrição encontrada
                </Typography>
              </Box>
            ) : (
              <List sx={{ width: '100%' }}>
                {prescricoes.map((prescricao) => (
                  <React.Fragment key={prescricao.id}>
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        mb: 2,
                        p: 2,
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight="bold" component="span">
                                Protocolo: {prescricao.protocolo}
                              </Typography>
                              <Chip
                                label={prescricao.doutor.nome}
                                size="small"
                                color="primary"
                                sx={{ ml: 2 }}
                              />
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="caption" color="text.secondary">
                                {moment(prescricao.createdAt).format('DD/MM/YYYY [às] HH:mm')}
                              </Typography>
                              <Tooltip title="Visualizar prescrição">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleVisualizarPrescricao(prescricao.protocolo)}
                                  sx={{ ml: 1 }}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box>
                            {prescricao.agendamento && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                <strong>Agendamento:</strong> {moment(prescricao.agendamento.dataHora).format('DD/MM/YYYY [às] HH:mm')} - {prescricao.agendamento.servico.nome}
                              </Typography>
                            )}
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                <strong>ID da Prescrição:</strong> {prescricao.id}
                              </Typography>
                              {prescricao.historicoId && (
                                <Typography 
                                  variant="body2" 
                                  color="primary"
                                  sx={{ 
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': {
                                      color: 'primary.dark',
                                    }
                                  }}
                                  onClick={() => {
                                    setActiveTab(1); // Mudar para aba de histórico
                                    // Scroll até o histórico específico após carregar os históricos
                                    const scrollToHistorico = () => {
                                      const historicoElement = document.getElementById(`historico-${prescricao.historicoId}`);
                                      if (historicoElement) {
                                        historicoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        // Destacar o histórico por um momento
                                        historicoElement.style.backgroundColor = 'rgba(25, 118, 210, 0.1)';
                                        setTimeout(() => {
                                          historicoElement.style.backgroundColor = '';
                                        }, 2000);
                                        return true;
                                      }
                                      return false;
                                    };
                                    
                                    // Tentar várias vezes até encontrar o elemento (aguardar carregamento)
                                    let attempts = 0;
                                    const maxAttempts = 10;
                                    const tryScroll = setInterval(() => {
                                      attempts++;
                                      if (scrollToHistorico() || attempts >= maxAttempts) {
                                        clearInterval(tryScroll);
                                      }
                                    }, 200);
                                  }}
                                >
                                  <strong>ID do Histórico (Atendimento):</strong> {prescricao.historicoId}
                                </Typography>
                              )}
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            <Typography
                              variant="body2"
                              component="div"
                              sx={{
                                whiteSpace: 'pre-wrap',
                                backgroundColor: 'grey.50',
                                p: 2,
                                borderRadius: 1,
                                mt: 1,
                              }}
                            >
                              {prescricao.conteudo}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ flexShrink: 0 }}>
        {agendamento && agendamento.status !== 'finalizado' && agendamento.id > 0 && onFinalizar && (
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<CheckCircleIcon />}
            onClick={handleAbrirModalFinalizar}
            disabled={!atendimentoIniciado && !inicioAtendimento}
            fullWidth
            sx={{ mr: 2, ml: 2, mb: 1, mt: 1 }}
          >
            Finalizar Atendimento
          </Button>
        )}
      </DialogActions>
    </Dialog>

      {/* Modal para Descrição do Atendimento */}
      <Dialog
        open={openModalFinalizar}
        onClose={handleFecharModalFinalizar}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Finalizar Atendimento
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Descrição do Atendimento"
            multiline
            rows={8}
            fullWidth
            value={descricaoFinalizacao}
            onChange={(e) => setDescricaoFinalizacao(e.target.value)}
            placeholder="Descreva os procedimentos realizados, medicamentos prescritos, recomendações e observações..."
            helperText="Campo obrigatório para finalizar a consulta"
            sx={{ mt: 2 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleFecharModalFinalizar}
            variant="outlined"
            disabled={finalizando}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handleFinalizarConsulta}
            disabled={!descricaoFinalizacao.trim() || finalizando}
          >
            {finalizando ? 'Finalizando...' : 'Confirmar Finalização'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Prescrição */}
      <Dialog 
        open={openPrescricaoModal} 
        onClose={() => {
          setOpenPrescricaoModal(false);
          setTextoPrescricao('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Nova Prescrição</Typography>
            <IconButton onClick={() => {
              setOpenPrescricaoModal(false);
              setTextoPrescricao('');
            }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Paciente: <strong>{agendamento?.paciente.nome}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Data: <strong>{moment().format('DD/MM/YYYY')}</strong>
            </Typography>
          </Box>
          
          <TextField
            label="Prescrição Médica"
            value={textoPrescricao}
            onChange={(e) => setTextoPrescricao(e.target.value)}
            fullWidth
            multiline
            rows={10}
            placeholder="Digite a prescrição médica aqui..."
            helperText="Digite os medicamentos, dosagens e orientações para o paciente"
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={async () => {
              try {
                console.log('Botão Gerar Prescrição clicado');
                console.log('Doutor atual:', doutorAtual);
                console.log('Agendamento:', agendamento);
                
                if (!doutorAtual) {
                  toast.error('Doutor não encontrado');
                  console.error('Doutor não encontrado');
                  return;
                }

                if (!textoPrescricao.trim()) {
                  toast.error('Digite a prescrição antes de gerar');
                  return;
                }

                if (!agendamento) {
                  toast.error('Agendamento não encontrado');
                  console.error('Agendamento não encontrado');
                  return;
                }

                console.log('Todos os dados validados, salvando prescrição...');
                // Salvar prescrição no banco de dados
                try {
                  await createPrescricao({
                    conteudo: textoPrescricao.trim(),
                    pacienteId: agendamento.paciente.id,
                    doutorId: doutorAtual.id,
                    agendamentoId: agendamento.id,
                  });
                  console.log('Prescrição salva com sucesso');
                } catch (error) {
                  console.error('Erro ao salvar prescrição:', error);
                  toast.error('Erro ao salvar prescrição');
                  return;
                }

                console.log('Iniciando geração do modelo...');
                // Carregar modelo do doutor ou usar padrão
              let modeloPrescricao: IModeloPrescricaoPDF = modeloPrescricaoPadrao;
              let logoURL = '';
              
              const modeloStr = doutorAtual.modeloPrescricao || '';
              if (modeloStr) {
                try {
                  // Parsear modelo como JSON
                  const modeloCarregado = JSON.parse(modeloStr) as IModeloPrescricaoPDF;
                  // Fazer merge com modelo padrão para garantir que todos os campos existam
                  modeloPrescricao = {
                    ...modeloPrescricaoPadrao,
                    ...modeloCarregado,
                    logoWatermark: {
                      ...modeloPrescricaoPadrao.logoWatermark,
                      ...(modeloCarregado.logoWatermark || {}),
                    },
                    header: {
                      ...modeloPrescricaoPadrao.header,
                      ...(modeloCarregado.header || {}),
                    },
                    medicoInfo: {
                      ...modeloPrescricaoPadrao.medicoInfo,
                      ...(modeloCarregado.medicoInfo || {}),
                    },
                    pacienteInfo: {
                      ...modeloPrescricaoPadrao.pacienteInfo,
                      ...(modeloCarregado.pacienteInfo || {}),
                      // Forçar CPF e endereço sempre visíveis
                      showCPF: true,
                      showEndereco: true,
                    },
                    prescricao: {
                      ...modeloPrescricaoPadrao.prescricao,
                      ...(modeloCarregado.prescricao || {}),
                    },
                    assinatura: {
                      ...modeloPrescricaoPadrao.assinatura,
                      ...(modeloCarregado.assinatura || {}),
                    },
                    footer: {
                      ...modeloPrescricaoPadrao.footer,
                      ...(modeloCarregado.footer || {}),
                    },
                  };
                  logoURL = modeloPrescricao.logoUrl || '';
                } catch (error) {
                  // Se não for JSON válido, usar modelo padrão
                  console.warn('Modelo de prescrição não é JSON válido, usando padrão:', error);
                  modeloPrescricao = modeloPrescricaoPadrao;
                  logoURL = '';
                }
              }
              
              // Preparar dados para o PDF
              // Montar endereço do paciente primeiro
              const enderecoPaciente = [
                agendamento?.paciente.logradouro,
                agendamento?.paciente.numero,
                agendamento?.paciente.bairro,
                agendamento?.paciente.cidade,
                agendamento?.paciente.estado
              ].filter(Boolean).join(', ') || '';
              
              // Separar texto da prescrição em linhas
              const itensPrescricao = textoPrescricao.split('\n').filter(line => line.trim());
              
              console.log('Modelo de prescrição final:', modeloPrescricao);
              console.log('showCPF:', modeloPrescricao.pacienteInfo.showCPF);
              console.log('showEndereco:', modeloPrescricao.pacienteInfo.showEndereco);
              console.log('CPF do paciente:', agendamento?.paciente.cpf);
              console.log('Endereço montado:', enderecoPaciente);
              console.log('Dados do paciente:', {
                logradouro: agendamento?.paciente.logradouro,
                numero: agendamento?.paciente.numero,
                bairro: agendamento?.paciente.bairro,
                cidade: agendamento?.paciente.cidade,
                estado: agendamento?.paciente.estado,
              });

              // Obter dados da clínica do doutorAtual (que tem dados completos) ou do agendamento como fallback
              const clinicaNome = doutorAtual.clinica?.nome || agendamento?.doutor.clinica?.nome || 'Clínica';
              const clinicaEndereco = doutorAtual.clinica?.endereco || agendamento?.doutor.clinica?.endereco || '';
              const clinicaTelefone = doutorAtual.clinica?.telefone || agendamento?.doutor.clinica?.telefone || '';
              const clinicaEmail = doutorAtual.clinica?.email || agendamento?.doutor.clinica?.email || doutorAtual.email || '';
              const clinicaSite = doutorAtual.clinica?.site || agendamento?.doutor.clinica?.site || '';
              const clinicaCNPJ = doutorAtual.clinica?.cnpj || agendamento?.doutor.clinica?.cnpj;

              console.log('Dados da clínica:', {
                clinicaNome,
                clinicaEndereco,
                clinicaTelefone,
                clinicaEmail,
                clinicaSite,
                clinicaCNPJ,
                doutorAtualClinica: doutorAtual.clinica,
                agendamentoClinica: agendamento?.doutor.clinica
              });

              // Gerar PDF
              const pdfDoc = (
                <PrescricaoPdfView
                  pacienteNome={agendamento?.paciente.nome || ''}
                  pacienteEndereco={enderecoPaciente}
                  pacienteCPF={agendamento?.paciente.cpf || undefined}
                  data={moment().format('YYYY-MM-DD')}
                  seguroSaude={agendamento?.paciente.convenio || ''}
                  diagnostico=""
                  doutorNome={doutorAtual.nome || ''}
                  doutorEspecialidade={doutorAtual.especialidade || ''}
                  doutorTagline={modeloPrescricao.medicoInfo.tagline || ''}
                  doutorCRM={doutorAtual.crm}
                  doutorCRMUF={doutorAtual.crmUf}
                  doutorRQE={doutorAtual.rqe}
                  itensPrescricao={itensPrescricao}
                  clinicaNome={clinicaNome}
                  clinicaEndereco={clinicaEndereco}
                  clinicaTelefone={clinicaTelefone}
                  clinicaEmail={clinicaEmail}
                  clinicaSite={clinicaSite}
                  clinicaCNPJ={clinicaCNPJ}
                  clinicaLogoUrl={logoURL}
                  modelo={modeloPrescricao}
                  isControleEspecial={false}
                />
              );

                // Gerar blob do PDF e abrir para impressão
                console.log('Iniciando geração do PDF...');
                console.log('PDF Document:', pdfDoc);
                pdf(pdfDoc).toBlob().then((blob) => {
                console.log('PDF gerado com sucesso, tamanho:', blob.size);
                if (blob.size === 0) {
                  toast.error('Erro: PDF gerado está vazio');
                  return;
                }
                
                const url = URL.createObjectURL(blob);
                console.log('URL do blob criada:', url);
                
                const printWindow = window.open(url, '_blank');
                if (printWindow) {
                  printWindow.onload = () => {
                    console.log('Janela de impressão carregada');
                    setTimeout(() => {
                      printWindow.print();
                      setOpenPrescricaoModal(false);
                      setTextoPrescricao('');
                      toast.success('Prescrição gerada com sucesso!');
                      // Limpar URL após um tempo
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, 250);
                  };
                  
                  printWindow.onerror = (error) => {
                    console.error('Erro ao carregar janela:', error);
                    toast.error('Erro ao abrir janela de impressão');
                  };
                } else {
                  toast.error('Não foi possível abrir a janela de impressão. Verifique se o pop-up está bloqueado.');
                }
                }).catch((error) => {
                  console.error('Erro ao gerar PDF:', error);
                  console.error('Detalhes do erro:', error.message, error.stack);
                  toast.error(`Erro ao gerar prescrição: ${error.message || 'Erro desconhecido'}`);
                });
              } catch (error: any) {
                console.error('Erro geral ao processar prescrição:', error);
                console.error('Stack trace:', error.stack);
                toast.error(`Erro: ${error.message || 'Erro desconhecido ao gerar prescrição'}`);
              }
            }}
            variant="contained"
            startIcon={<DescriptionIcon />}
          >
            Gerar Prescrição
          </Button>
          <Button
            onClick={() => {
              setOpenPrescricaoModal(false);
              setTextoPrescricao('');
            }}
          >
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Visualização/Edição do Histórico */}
      <Dialog
        open={openModalHistorico}
        onClose={handleFecharModalHistorico}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <DescriptionIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Visualizar/Editar Atendimento
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {historicoSelecionado && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                <strong>Data do Atendimento:</strong> {moment(historicoSelecionado.realizadoEm).format('DD/MM/YYYY [às] HH:mm')}
              </Typography>
              {historicoSelecionado.duracaoMinutos && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  <strong>Duração:</strong> {historicoSelecionado.duracaoMinutos} minutos
                </Typography>
              )}
              <TextField
                label="Descrição do Atendimento"
                multiline
                rows={12}
                fullWidth
                value={descricaoEditando}
                onChange={(e) => setDescricaoEditando(e.target.value)}
                placeholder="Descreva os procedimentos realizados, medicamentos prescritos, recomendações e observações..."
                sx={{ mt: 2 }}
                autoFocus
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleFecharModalHistorico}
            variant="outlined"
            disabled={salvandoHistorico}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<CheckCircleIcon />}
            onClick={handleSalvarHistorico}
            disabled={!descricaoEditando.trim() || salvandoHistorico}
          >
            {salvandoHistorico ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
  
