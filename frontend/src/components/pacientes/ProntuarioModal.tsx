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
  Autocomplete,
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
import DescriptionIcon from '@mui/icons-material/Description';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MedicationIcon from '@mui/icons-material/Medication';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import ScienceIcon from '@mui/icons-material/Science';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReactMarkdown from 'react-markdown';
import type { Components as ReactMarkdownComponents } from 'react-markdown';
import { IAgendamento, IHistoricoPaciente, IPaciente, IDoutor, IProntuarioChatMessage, IPrescricao } from '../../types/models';
import { getPacienteHistoricos, updatePaciente, updateHistoricoPaciente } from '../../services/paciente.service';
import { getDoutores } from '../../services/doutor.service';
import { getProntuarioChatMessages, sendProntuarioChatMessage } from '../../services/prontuarioChat.service';
import { getPrescricoesPaciente, createPrescricao, getPrescricaoByProtocolo, invalidatePrescricao } from '../../services/prescricao.service';
import { getAtestadosPaciente, getAtestadoByProtocolo, invalidateAtestado } from '../../services/atestado.service';
import { IAtestado } from '../../types/atestado';
import { getMedicamentos } from '../../services/medicamento.service';
import { IMedicamento } from '../../types/models';
import { AlergiaFormModal } from '../prescricoes/AlergiaFormModal';
import { AlergiaAlertaModal } from '../prescricoes/AlergiaAlertaModal';
import { getAlergiasByPaciente, verificarAlergia, deleteAlergia, IAlergiaMedicamento, VerificacaoAlergia } from '../../services/alergia.service';
import { ConfirmarExclusaoAlergiaModal } from '../prescricoes/ConfirmarExclusaoAlergiaModal';
import { useAuth } from '../../hooks/useAuth';
import moment from 'moment';
import 'moment/locale/pt-br';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import PrescricaoPdfView from '../PrescricaoPdfView';
import { IModeloPrescricaoPDF, modeloPrescricaoPadrao } from '../../types/prescricao';
import { PacienteFormModal } from './PacienteFormModal';
import { AtestadoFormModal } from '../atestados/AtestadoFormModal';
import AtestadoPdfView from '../AtestadoPdfView';
import { InvalidarDocumentoModal } from '../InvalidarDocumentoModal';

moment.locale('pt-br');

interface Props {
  open: boolean;
  onClose: () => void;
  agendamento: IAgendamento | null;
  onFinalizar?: (descricao: string, duracaoMinutos?: number) => Promise<void>;
  autoIniciar?: boolean; // Se true, inicia o atendimento automaticamente ao abrir
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

export const ProntuarioModal: React.FC<Props> = ({ open, onClose, agendamento, onFinalizar, autoIniciar = false }) => {
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
  const toastExibidoRef = useRef<number | null>(null); // Para evitar toasts duplicados
  
  // Estados para prescrição
  const [openPrescricaoModal, setOpenPrescricaoModal] = useState(false);
  const [textoPrescricao, setTextoPrescricao] = useState('');
  const [doutorAtual, setDoutorAtual] = useState<IDoutor | null>(null);
  const [prescricoes, setPrescricoes] = useState<IPrescricao[]>([]);
  const [loadingPrescricoes, setLoadingPrescricoes] = useState(false);
  const [prescricoesError, setPrescricoesError] = useState<string | null>(null);
  
  // Estados para atestado
  const [openAtestadoModal, setOpenAtestadoModal] = useState(false);
  const [atestados, setAtestados] = useState<IAtestado[]>([]);
  const [loadingAtestados, setLoadingAtestados] = useState(false);
  const [atestadosError, setAtestadosError] = useState<string | null>(null);
  
  // Estados para modal de alergias
  const [openAlergiaModal, setOpenAlergiaModal] = useState(false);
  const [openPerguntaAlergiaModal, setOpenPerguntaAlergiaModal] = useState(false);
  const [alergiasPaciente, setAlergiasPaciente] = useState<IAlergiaMedicamento[]>([]);
  const [mostrouPerguntaAlergia, setMostrouPerguntaAlergia] = useState(false);
  const [openAlergiaAlertaModal, setOpenAlergiaAlertaModal] = useState(false);
  const [alergiaAlertaInfo, setAlergiaAlertaInfo] = useState<{
    medicamentoNome: string;
    verificacao: VerificacaoAlergia;
  } | null>(null);
  const [openConfirmarExclusaoAlergia, setOpenConfirmarExclusaoAlergia] = useState(false);
  const [alergiaParaExcluir, setAlergiaParaExcluir] = useState<IAlergiaMedicamento | null>(null);
  const [loadingExclusaoAlergia, setLoadingExclusaoAlergia] = useState(false);
  
  // Estado para modal de alerta de horário
  const [openModalAlertaHorario, setOpenModalAlertaHorario] = useState(false);
  const [infoAlertaHorario, setInfoAlertaHorario] = useState<{
    estaAtrasado: boolean;
    diferencaFormatada: string;
    horarioAgendado: string;
    diferencaMinutos: number;
  } | null>(null);
  
  // Estados para busca de medicamentos
  const [openMedicamentoModal, setOpenMedicamentoModal] = useState(false);
  const [openInvalidarModal, setOpenInvalidarModal] = useState(false);
  const [documentoParaInvalidar, setDocumentoParaInvalidar] = useState<{ tipo: 'prescricao' | 'atestado'; id: number } | null>(null);
  const [buscaMedicamento, setBuscaMedicamento] = useState('');
  const [buscaPrincipioAtivo, setBuscaPrincipioAtivo] = useState('');
  const [buscaEmpresa, setBuscaEmpresa] = useState('');
  const [buscaCategoria, setBuscaCategoria] = useState('');
  const [medicamentosEncontrados, setMedicamentosEncontrados] = useState<IMedicamento[]>([]);
  const [loadingMedicamentos, setLoadingMedicamentos] = useState(false);
  const [medicamentoSelecionado, setMedicamentoSelecionado] = useState<IMedicamento | null>(null);
  const [quantidadeMedicamento, setQuantidadeMedicamento] = useState<number>(1);
  const [unidadeMedicamento, setUnidadeMedicamento] = useState<'comprimidos' | 'caixa'>('caixa');
  const [quantidadeComprimidos, setQuantidadeComprimidos] = useState<number | ''>('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);

  // Estado do modal de edição de paciente
  const [openPacienteForm, setOpenPacienteForm] = useState(false);

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

  // Funções para persistir o estado do atendimento
  const getStorageKey = (agendamentoId: number): string => {
    return `atendimento_pausado_${agendamentoId}`;
  };

  const salvarEstadoAtendimento = (agendamentoId: number, inicioAtendimento: Date | null, tempoDecorrido: number) => {
    try {
      if (inicioAtendimento) {
        // Só salva se houver um atendimento iniciado (mesmo que pausado)
        const estado = {
          inicioAtendimento: inicioAtendimento.toISOString(),
          tempoDecorrido,
          timestamp: new Date().toISOString(),
        };
        const key = getStorageKey(agendamentoId);
        localStorage.setItem(key, JSON.stringify(estado));
        console.log('[Atendimento] Estado salvo:', { agendamentoId, tempoDecorrido, key });
      }
    } catch (error) {
      console.error('Erro ao salvar estado do atendimento:', error);
    }
  };

  const carregarEstadoAtendimento = (agendamentoId: number): { inicioAtendimento: Date | null; tempoDecorrido: number } | null => {
    try {
      const key = getStorageKey(agendamentoId);
      const estadoSalvo = localStorage.getItem(key);
      
      console.log('[Atendimento] Tentando carregar estado:', { agendamentoId, key, existe: !!estadoSalvo });
      
      if (!estadoSalvo) {
        console.log('[Atendimento] Nenhum estado salvo encontrado');
        return null;
      }

      const estado = JSON.parse(estadoSalvo);
      const inicioAtendimento = estado.inicioAtendimento ? new Date(estado.inicioAtendimento) : null;
      
      // Verificar se o estado não é muito antigo (mais de 24 horas)
      if (estado.timestamp) {
        const dataSalvamento = new Date(estado.timestamp);
        const agora = new Date();
        const diferencaHoras = (agora.getTime() - dataSalvamento.getTime()) / (1000 * 60 * 60);
        
        if (diferencaHoras > 24) {
          // Limpar estado antigo
          console.log('[Atendimento] Estado muito antigo, removendo:', diferencaHoras);
          localStorage.removeItem(key);
          return null;
        }
      }

      console.log('[Atendimento] Estado carregado com sucesso:', { 
        inicioAtendimento: inicioAtendimento?.toISOString(), 
        tempoDecorrido: estado.tempoDecorrido 
      });

      return {
        inicioAtendimento,
        tempoDecorrido: estado.tempoDecorrido || 0,
      };
    } catch (error) {
      console.error('Erro ao carregar estado do atendimento:', error);
      return null;
    }
  };

  const limparEstadoAtendimento = (agendamentoId: number) => {
    try {
      localStorage.removeItem(getStorageKey(agendamentoId));
    } catch (error) {
      console.error('Erro ao limpar estado do atendimento:', error);
    }
  };

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

  // Carregar estado do atendimento quando o modal abrir
  useEffect(() => {
    if (open && agendamento?.id) {
      // Tentar carregar estado salvo
      const estadoSalvo = carregarEstadoAtendimento(agendamento.id);
      if (estadoSalvo && estadoSalvo.inicioAtendimento) {
        // Restaurar o estado do atendimento
        setInicioAtendimento(estadoSalvo.inicioAtendimento);
        setTempoDecorrido(estadoSalvo.tempoDecorrido);
        setAtendimentoIniciado(false);
        
        // Exibir toast apenas uma vez por agendamento
        if (toastExibidoRef.current !== agendamento.id) {
          toast.info('Atendimento pausado encontrado. Você pode retomar de onde parou.');
          toastExibidoRef.current = agendamento.id;
        }
      }
      
      carregarChatGemini(agendamento.id, true);
    }
  }, [open, agendamento?.id]);

  // Resetar quando o modal fechar
  useEffect(() => {
    if (!open) {
      // IMPORTANTE: Salvar estado do atendimento ANTES de resetar qualquer coisa
      if (agendamento?.id && inicioAtendimento) {
        salvarEstadoAtendimento(agendamento.id, inicioAtendimento, tempoDecorrido);
      }
      
      // Resetar ref do toast para permitir exibição novamente quando abrir outro agendamento
      toastExibidoRef.current = null;
      
      setAtendimentoIniciado(false);
      // NÃO resetar tempoDecorrido e inicioAtendimento imediatamente - eles serão carregados quando o modal abrir
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
      // Resetar estados de medicamentos
      setOpenMedicamentoModal(false);
      setBuscaMedicamento('');
      setBuscaPrincipioAtivo('');
      setBuscaEmpresa('');
      setBuscaCategoria('');
      setMedicamentosEncontrados([]);
      setMedicamentoSelecionado(null);
      setQuantidadeMedicamento(1);
      setUnidadeMedicamento('caixa');
      setQuantidadeComprimidos('');
      
      // Resetar estados do atendimento apenas se não houver estado salvo
      // Verificar após um pequeno delay para garantir que o salvamento foi feito
      const timer = setTimeout(() => {
        if (!open && agendamento?.id) {
          const estadoSalvo = carregarEstadoAtendimento(agendamento.id);
          if (!estadoSalvo) {
            // Só resetar se não houver estado salvo
            setTempoDecorrido(0);
            setInicioAtendimento(null);
          }
        }
      }, 200);
      
      return () => clearTimeout(timer);
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


  // Auto-iniciar atendimento se a prop autoIniciar for true
  useEffect(() => {
    if (open && autoIniciar && agendamento && !atendimentoIniciado && !inicioAtendimento && agendamento.status !== 'finalizado') {
      // Pequeno delay para garantir que o modal esteja totalmente renderizado
      const timer = setTimeout(() => {
        handleIniciarAtendimento();
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoIniciar, agendamento?.id, atendimentoIniciado, inicioAtendimento]);

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
    if (open && activeTab === 2 && agendamento?.paciente.id) {
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

  // Carregar atestados quando a aba de atestados for aberta
  useEffect(() => {
    if (open && activeTab === 3 && agendamento?.paciente.id) {
      const carregarAtestados = async () => {
        try {
          setLoadingAtestados(true);
          setAtestadosError(null);
          const data = await getAtestadosPaciente(agendamento.paciente.id);
          setAtestados(data);
        } catch (err: any) {
          setAtestadosError(err?.response?.data?.message ?? 'Não foi possível carregar os atestados.');
        } finally {
          setLoadingAtestados(false);
        }
      };
      carregarAtestados();
    }
  }, [open, activeTab, agendamento?.paciente.id]);

  // Carregar alergias do paciente quando a aba de alergias for aberta
  useEffect(() => {
    if (open && activeTab === 4 && agendamento?.paciente.id) {
      const loadAlergias = async () => {
        try {
          const alergias = await getAlergiasByPaciente(agendamento.paciente.id);
          setAlergiasPaciente(alergias);
        } catch (error) {
          console.error('Erro ao carregar alergias:', error);
        }
      };
      loadAlergias();
    }
  }, [open, activeTab, agendamento?.paciente.id]);

  // Carregar alergias do paciente quando o agendamento for carregado (para verificação em prescrições)
  useEffect(() => {
    const loadAlergias = async () => {
      if (agendamento?.paciente?.id) {
        try {
          const alergias = await getAlergiasByPaciente(agendamento.paciente.id);
          setAlergiasPaciente(alergias);
        } catch (error) {
          console.error('Erro ao carregar alergias:', error);
        }
      } else {
        setAlergiasPaciente([]);
      }
    };
    loadAlergias();
  }, [agendamento?.paciente?.id]);

  // Mostrar pergunta sobre alergias quando o modal de prescrição abrir pela primeira vez
  useEffect(() => {
    if (openPrescricaoModal && agendamento?.paciente && !mostrouPerguntaAlergia) {
      const timer = setTimeout(() => {
        setOpenPerguntaAlergiaModal(true);
        setMostrouPerguntaAlergia(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [openPrescricaoModal, agendamento?.paciente, mostrouPerguntaAlergia]);

  const handleIniciarAtendimento = () => {
    // Verificar se está iniciando fora do horário agendado com janela muito grande
    if (agendamento?.dataHora) {
      const horarioAgendado = moment(agendamento.dataHora);
      const horarioAtual = moment();
      const diferencaMinutos = Math.abs(horarioAtual.diff(horarioAgendado, 'minutes'));
      
      // Limite de 30 minutos para considerar "janela muito grande"
      const LIMITE_JANELA_MINUTOS = 30;
      
      if (diferencaMinutos > LIMITE_JANELA_MINUTOS) {
        const estaAtrasado = horarioAtual.isAfter(horarioAgendado);
        const diferencaFormatada = moment.duration(diferencaMinutos, 'minutes').humanize();
        
        // Mostrar modal de alerta antes de iniciar
        setInfoAlertaHorario({
          estaAtrasado,
          diferencaFormatada,
          horarioAgendado: horarioAgendado.format('DD/MM/YYYY [às] HH:mm'),
          diferencaMinutos,
        });
        setOpenModalAlertaHorario(true);
        return; // Não iniciar ainda, aguardar confirmação do usuário
      }
    }
    
    // Se não houver problema de horário, iniciar diretamente
    iniciarAtendimentoConfirmado();
  };

  const iniciarAtendimentoConfirmado = () => {
    // Limpar estado salvo anterior se houver (para evitar conflitos)
    if (agendamento?.id) {
      limparEstadoAtendimento(agendamento.id);
    }
    
    setAtendimentoIniciado(true);
    setInicioAtendimento(new Date());
    toast.success('Atendimento iniciado!');
  };

  const handleConfirmarIniciarApesarHorario = () => {
    setOpenModalAlertaHorario(false);
    setInfoAlertaHorario(null);
    iniciarAtendimentoConfirmado();
  };

  const handleCancelarIniciarAtendimento = () => {
    setOpenModalAlertaHorario(false);
    setInfoAlertaHorario(null);
  };

  const handlePausarAtendimento = () => {
    setAtendimentoIniciado(false);
    // Salvar estado imediatamente ao pausar
    if (agendamento?.id && inicioAtendimento) {
      salvarEstadoAtendimento(agendamento.id, inicioAtendimento, tempoDecorrido);
    }
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

  const handleCloseModal = (_event?: {}, _reason?: string) => {
    // Impedir fechamento se o atendimento estiver ativo
    if (atendimentoIniciado) {
      toast.warning('Não é possível fechar o prontuário enquanto o atendimento estiver ativo. Pause ou finalize o atendimento primeiro.');
      return;
    }
    
    // Permitir fechamento normal se o atendimento não estiver ativo
    onClose();
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
      
      // Limpar estado do atendimento do localStorage quando finalizado
      if (agendamento?.id) {
        limparEstadoAtendimento(agendamento.id);
      }
      
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

  const handleSubmitPacienteModal = async (data: Omit<IPaciente, 'id' | 'clinicaId'>) => {
    if (!agendamento?.paciente.id) return;
    try {
      setSalvandoPaciente(true);
      await updatePaciente(agendamento.paciente.id, data);
      Object.assign(agendamento.paciente, data);
      setOpenPacienteForm(false);
      toast.success('Dados do paciente atualizados com sucesso!');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Erro ao salvar dados do paciente');
    } finally {
      setSalvandoPaciente(false);
    }
  };

  // Carregar lista de empresas e categorias uma vez
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const allData = await getMedicamentos({ skip: 0, take: 10000 });
        const allEmpresas = new Set<string>();
        const allCategorias = new Set<string>();
        
        allData.medicamentos.forEach((m) => {
          if (m.empresaDetentoraRegistro) {
            allEmpresas.add(m.empresaDetentoraRegistro);
          }
          if (m.categoriaRegulatoria) {
            allCategorias.add(m.categoriaRegulatoria);
          }
        });

        setEmpresas(Array.from(allEmpresas).sort());
        setCategorias(Array.from(allCategorias).sort());
      } catch (err) {
        console.error('Erro ao carregar opções de empresas e categorias:', err);
      }
    };

    if (openMedicamentoModal) {
      loadOptions();
    }
  }, [openMedicamentoModal]);

  // Buscar medicamentos com filtros
  const buscarMedicamentos = async () => {
    // Só busca se houver pelo menos um filtro preenchido
    const temFiltro = buscaMedicamento.trim() || buscaPrincipioAtivo.trim() || buscaEmpresa.trim() || buscaCategoria.trim();
    
    if (!temFiltro) {
      setMedicamentosEncontrados([]);
      return;
    }

    try {
      setLoadingMedicamentos(true);
      const filters: any = {
        take: 20, // Aumentar para 20 resultados
      };

      if (buscaMedicamento.trim()) {
        filters.nomeProduto = buscaMedicamento.trim();
      }
      if (buscaPrincipioAtivo.trim()) {
        filters.principioAtivo = buscaPrincipioAtivo.trim();
      }
      if (buscaEmpresa.trim()) {
        filters.empresaDetentoraRegistro = buscaEmpresa.trim();
      }
      if (buscaCategoria.trim()) {
        filters.categoriaRegulatoria = buscaCategoria.trim();
      }

      const resultado = await getMedicamentos(filters);
      setMedicamentosEncontrados(resultado.medicamentos);
    } catch (error: any) {
      console.error('Erro ao buscar medicamentos:', error);
      toast.error('Erro ao buscar medicamentos');
    } finally {
      setLoadingMedicamentos(false);
    }
  };

  // Debounce para busca de medicamentos - quando qualquer filtro mudar
  useEffect(() => {
    const timer = setTimeout(() => {
      buscarMedicamentos();
    }, 500);

    return () => clearTimeout(timer);
  }, [buscaMedicamento, buscaPrincipioAtivo, buscaEmpresa, buscaCategoria]);

  // Adicionar medicamento à prescrição
  const handleAdicionarMedicamento = async () => {
    if (!medicamentoSelecionado) {
      toast.error('Selecione um medicamento');
      return;
    }

    if (quantidadeMedicamento <= 0) {
      toast.error('A quantidade deve ser maior que zero');
      return;
    }

    // Validar alergia antes de adicionar
    if (agendamento?.paciente) {
      try {
        const resultado = await verificarAlergia(
          agendamento.paciente.id,
          medicamentoSelecionado.nomeProduto,
          medicamentoSelecionado.principioAtivo || undefined,
          medicamentoSelecionado.classeTerapeutica || undefined,
          undefined // excipientes não disponível no medicamento
        );

        if (resultado.temAlergia) {
          // Bloquear completamente - mostrar modal e não permitir continuar
          setAlergiaAlertaInfo({
            medicamentoNome: medicamentoSelecionado.nomeProduto,
            verificacao: resultado,
          });
          setOpenAlergiaAlertaModal(true);
          return; // Bloquear a adição do medicamento
        }
      } catch (error) {
        console.error('Erro ao verificar alergia:', error);
      }
    }

    const nomeMedicamento = medicamentoSelecionado.nomeProduto;
    let linhaMedicamento = '';
    const larguraTotal = 100; // Largura total da linha (aumentado para melhor alinhamento)

    if (unidadeMedicamento === 'caixa') {
      if (quantidadeComprimidos && quantidadeComprimidos > 0) {
        // Formato: Escitalopram................................................................................1caixa(60 comprimidos)
        const sufixo = `${quantidadeMedicamento}caixa(${quantidadeComprimidos} comprimidos)`;
        const tamanhoPontos = Math.max(1, larguraTotal - nomeMedicamento.length - sufixo.length);
        linhaMedicamento = `${nomeMedicamento}${'.'.repeat(tamanhoPontos)}${sufixo}`;
      } else {
        // Formato: Escitalopram................................................................................1caixa
        const sufixo = `${quantidadeMedicamento}caixa`;
        const tamanhoPontos = Math.max(1, larguraTotal - nomeMedicamento.length - sufixo.length);
        linhaMedicamento = `${nomeMedicamento}${'.'.repeat(tamanhoPontos)}${sufixo}`;
      }
    } else {
      // Formato: Escitalopram................................................................................60 comprimidos
      const sufixo = `${quantidadeMedicamento} comprimidos`;
      const tamanhoPontos = Math.max(1, larguraTotal - nomeMedicamento.length - sufixo.length);
      linhaMedicamento = `${nomeMedicamento}${'.'.repeat(tamanhoPontos)}${sufixo}`;
    }

    // Adicionar à prescrição
    const novaPrescricao = textoPrescricao 
      ? `${textoPrescricao}\n${linhaMedicamento}`
      : linhaMedicamento;
    
    setTextoPrescricao(novaPrescricao);

    // Limpar campos e fechar modal
    setBuscaMedicamento('');
    setMedicamentoSelecionado(null);
    setMedicamentosEncontrados([]);
    setQuantidadeMedicamento(1);
    setUnidadeMedicamento('caixa');
    setQuantidadeComprimidos('');
    setOpenMedicamentoModal(false);

    toast.success('Medicamento adicionado à prescrição');
  };

  const handleFecharModalMedicamento = () => {
    setOpenMedicamentoModal(false);
    setBuscaMedicamento('');
    setBuscaPrincipioAtivo('');
    setBuscaEmpresa('');
    setBuscaCategoria('');
    setMedicamentoSelecionado(null);
    setMedicamentosEncontrados([]);
    setQuantidadeMedicamento(1);
    setUnidadeMedicamento('caixa');
    setQuantidadeComprimidos('');
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
          invalidado={prescricao.invalidado}
          motivoInvalidacao={prescricao.motivoInvalidacao || undefined}
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
      onClose={handleCloseModal} 
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
          <IconButton onClick={handleCloseModal}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mt: 2 }}>
          <Tab label="Prontuário" />
          <Tab label="Histórico de Atendimentos" />
          <Tab label="Prescrições" />
          <Tab label="Atestados" />
          <Tab label="Alergias" />
        </Tabs>
      </DialogTitle>
      <DialogContent 
        dividers
        sx={{
          flex: 1,
          overflow: activeTab === 0 || activeTab === 1 || activeTab === 2 || activeTab === 3 || activeTab === 4 ? 'hidden' : 'auto',
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
                      <Avatar 
                        src={agendamento.paciente.foto || undefined}
                        sx={{ 
                          bgcolor: 'primary.main', 
                          width: 64, 
                          height: 64,
                          fontSize: '1.5rem',
                          border: '2px solid',
                          borderColor: 'primary.light',
                        }}
                      >
                        {!agendamento.paciente.foto && (
                          agendamento.paciente.nome 
                            ? agendamento.paciente.nome
                                .split(' ')
                                .map(n => n[0])
                                .filter((_, i, arr) => i === 0 || i === arr.length - 1)
                                .join('')
                                .toUpperCase()
                                .substring(0, 2)
                            : <PersonIcon sx={{ fontSize: 32 }} />
                        )}
                      </Avatar>
                      <Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="h6" fontWeight="bold">
                            {agendamento.paciente.nome}
                          </Typography>
                          <Tooltip title="Editar Dados do Paciente">
                            <IconButton size="small" onClick={() => setOpenPacienteForm(true)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Chip
                          label={agendamento.status === 'finalizado' ? 'Finalizado' : 'Em Atendimento'}
                          color={agendamento.status === 'finalizado' ? 'success' : 'primary'}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    </Stack>

                    <Stack direction="column" spacing={0} alignItems="flex-end">
                      <Button
                        variant="contained"
                        size="small"
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
                          disabled={(!atendimentoIniciado && !inicioAtendimento) || agendamento.status === 'finalizado'}
                          sx={{ 
                            width: 120,
                            height: 36,
                            boxShadow: 2,
                            '&:hover': {
                              boxShadow: 4,
                            }
                          }}
                        >
                          Prescrição
                        </Button>
                        
                        {/* Botão Atestado - Fluxo contínuo após Prescrição */}
                        <Button
                          variant="contained"
                          color="info"
                          size="small"
                          startIcon={<DescriptionIcon />}
                          onClick={() => setOpenAtestadoModal(true)}
                          disabled={(!atendimentoIniciado && !inicioAtendimento) || agendamento.status === 'finalizado'}
                          sx={{ 
                            width: 120,
                            height: 36,
                            mt: '2px',
                            boxShadow: 2,
                            '&:hover': {
                              boxShadow: 4,
                            }
                          }}
                        >
                          Atestado
                        </Button>
                    </Stack>
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
                    <Typography variant="body2">
                      {agendamento.paciente.telefone}
                      {agendamento.paciente.cidade && (
                        <>
                          <Box component="span" sx={{ mx: 1, color: 'text.secondary' }}>•</Box>
                          <Box component="span" sx={{ color: 'text.secondary' }}>
                            {agendamento.paciente.cidade}
                          </Box>
                        </>
                      )}
                    </Typography>
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
                  {alergiasPaciente.length > 0 ? (
                    <Alert severity="error" icon={<WarningIcon />} sx={{ py: 0.5 }}>
                      <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                        ALERTA: Alergias Conhecidas
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {alergiasPaciente.map((alergia) => (
                          <Chip
                            key={alergia.id}
                            label={alergia.principioAtivo || alergia.nomeMedicamento}
                            color="error"
                            size="small"
                            sx={{ fontSize: '0.7rem', height: 22 }}
                            title={`${alergia.nomeMedicamento} - ${alergia.principioAtivo}${alergia.classeQuimica ? ` (Classe: ${alergia.classeQuimica})` : ''}`}
                          />
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
                        ALERTA: Nenhuma alergia conhecida
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
                  const atestadosHistorico = historico.atestados || historico.agendamento?.atestados || [];
                  
                  // Função para extrair o primeiro medicamento do conteúdo
                  const extrairPrimeiroMedicamento = (conteudo: string): string => {
                    if (!conteudo) return '';
                    const linhas = conteudo.split('\n').filter(line => line.trim());
                    if (linhas.length === 0) return '';
                    const primeiraLinha = linhas[0].trim();
                    // Limitar a 30 caracteres e adicionar ... se necessário
                    return primeiraLinha.length > 30 ? primeiraLinha.substring(0, 30) + '...' : primeiraLinha;
                  };

                  // Função para formatar texto da prescrição para tooltip (mantém quebras entre medicamentos)
                  const formatarTextoPrescricaoTooltip = (conteudo: string): string => {
                    if (!conteudo) return 'Sem conteúdo';
                    // Manter quebras de linha entre medicamentos, mas limpar espaços múltiplos dentro de cada linha
                    return conteudo
                      .split('\n')
                      .map(line => line.trim().replace(/\s+/g, ' '))
                      .filter(line => line.length > 0)
                      .join('\n');
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
                                    const isPrescricaoAvulsa = !('agendamentoId' in prescricao) || prescricao.agendamentoId === null || prescricao.agendamentoId === undefined;
                                    const labelTexto = primeiroMedicamento 
                                      ? `#${prescricao.id} - ${primeiroMedicamento}`
                                      : `#${prescricao.id}`;
                                    
                                    return (
                                      <Box key={prescricao.id} sx={{ display: 'inline-block', mr: 0.5, mb: 0.5 }}>
                                        <Tooltip
                                          title={formatarTextoPrescricaoTooltip(prescricao.conteudo || '')}
                                          arrow
                                          enterDelay={500}
                                          placement="top"
                                          slotProps={{
                                            tooltip: {
                                              sx: {
                                                maxWidth: 900,
                                                whiteSpace: 'pre-line',
                                                fontSize: '0.875rem',
                                                lineHeight: 1.5,
                                              },
                                            },
                                          }}
                                        >
                                          <Chip
                                            label={labelTexto}
                                            size="small"
                                            variant="outlined"
                                            color="success"
                                            onClick={() => handleVisualizarPrescricao(prescricao.protocolo)}
                                            sx={{ 
                                              cursor: 'pointer',
                                              '&:hover': {
                                                backgroundColor: 'primary.light',
                                                color: 'primary.main',
                                                borderColor: 'primary.main',
                                              }
                                            }}
                                          />
                                        </Tooltip>
                                        {isPrescricaoAvulsa && (
                                          <Chip
                                            label="Prescrição Fora do Atendimento"
                                            size="small"
                                            color="warning"
                                            variant="filled"
                                            sx={{ ml: 0.5, fontSize: '0.65rem', height: '20px' }}
                                          />
                                        )}
                                      </Box>
                                    );
                                  })}
                                </Box>
                              )}
                              {atestadosHistorico.length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                    Atestados Médicos:
                                  </Typography>
                                  {atestadosHistorico.map((atestado: any) => {
                                    const diasAfastamento = atestado.diasAfastamento || 0;
                                    
                                    // Formatar texto do período de afastamento
                                    let diasTexto: string;
                                    if (diasAfastamento < 1) {
                                      // Se for menos de 1 dia, calcular em minutos
                                      const minutos = Math.round(diasAfastamento * 24 * 60);
                                      if (minutos < 60) {
                                        diasTexto = `${minutos} minutos`;
                                      } else {
                                        const horas = Math.floor(minutos / 60);
                                        const minutosRestantes = minutos % 60;
                                        if (minutosRestantes === 0) {
                                          diasTexto = horas === 1 ? '1 hora' : `${horas} horas`;
                                        } else {
                                          diasTexto = `${horas}h${minutosRestantes.toString().padStart(2, '0')}`;
                                        }
                                      }
                                    } else {
                                      const dias = Math.floor(diasAfastamento);
                                      diasTexto = dias === 1 ? '1 dia' : `${dias} dias`;
                                    }
                                    
                                    const isAtestadoAvulso = !atestado.agendamentoId || atestado.agendamentoId === null;
                                    const labelTexto = `#${atestado.id} - ${diasTexto}`;
                                    
                                    return (
                                      <Box key={atestado.id} sx={{ display: 'inline-block', mr: 0.5, mb: 0.5 }}>
                                        <Tooltip
                                          title={`Atestado: ${diasTexto}${atestado.cid && atestado.exibirCid ? ` - CID: ${atestado.cid}` : ''}${atestado.conteudo ? `\n${atestado.conteudo}` : ''}`}
                                          arrow
                                          enterDelay={500}
                                          placement="top"
                                          slotProps={{
                                            tooltip: {
                                              sx: {
                                                maxWidth: 400,
                                                whiteSpace: 'pre-line',
                                                fontSize: '0.875rem',
                                                lineHeight: 1.5,
                                              },
                                            },
                                          }}
                                        >
                                          <Chip
                                            label={labelTexto}
                                            size="small"
                                            variant="outlined"
                                            color="info"
                                            onClick={async () => {
                                              try {
                                                const atestadoCompleto = await getAtestadoByProtocolo(atestado.protocolo);
                                                const { getDoutorById } = await import('../../services/doutor.service');
                                                const doutor = await getDoutorById(atestadoCompleto.doutorId);
                                                
                                                const clinicaNome = doutor.clinica?.nome || 'Clínica';
                                                const clinicaEndereco = doutor.clinica?.endereco || '';
                                                const clinicaTelefone = doutor.clinica?.telefone || '';
                                                const clinicaEmail = doutor.clinica?.email || doutor.email || '';
                                                const clinicaSite = doutor.clinica?.site || '';
                                                
                                                const horaAtendimento = atestadoCompleto.agendamento?.dataHora
                                                  ? moment(atestadoCompleto.agendamento.dataHora).format('HH:mm')
                                                  : moment(atestadoCompleto.createdAt).format('HH:mm');
                                                
                                                // Determinar tipo de afastamento: se tem horaInicial e horaFinal, é horas
                                                const tipoAfastamento = (atestadoCompleto.horaInicial && atestadoCompleto.horaFinal) ? 'horas' : (atestadoCompleto.diasAfastamento < 1 ? 'horas' : 'dias');
                                                const dataAtestadoFormatada = atestadoCompleto.dataAtestado
                                                  ? moment(atestadoCompleto.dataAtestado).format('YYYY-MM-DD')
                                                  : moment(atestadoCompleto.createdAt).format('YYYY-MM-DD');
                                                
                                                const pdfDoc = (
                                                  <AtestadoPdfView
                                                    pacienteNome={atestadoCompleto.paciente?.nome || ''}
                                                    pacienteCPF={atestadoCompleto.paciente?.cpf || undefined}
                                                    dataAtendimento={dataAtestadoFormatada}
                                                    horaAtendimento={horaAtendimento}
                                                    diasAfastamento={atestadoCompleto.diasAfastamento}
                                                    tipoAfastamento={tipoAfastamento}
                                                    horaInicial={atestadoCompleto.horaInicial || undefined}
                                                    horaFinal={atestadoCompleto.horaFinal || undefined}
                                                    cid={atestadoCompleto.cid || undefined}
                                                    exibirCid={atestadoCompleto.exibirCid}
                                                    conteudo={atestadoCompleto.conteudo || ''}
                                                    localAtendimento={atestadoCompleto.localAtendimento || 'Consultório'}
                                                    doutorNome={doutor.nome || ''}
                                                    doutorEspecialidade={doutor.especialidade || ''}
                                                    doutorCRM={doutor.crm}
                                                    doutorCRMUF={doutor.crmUf}
                                                    doutorRQE={doutor.rqe}
                                                    clinicaNome={clinicaNome}
                                                    clinicaEndereco={clinicaEndereco}
                                                    clinicaTelefone={clinicaTelefone}
                                                    clinicaEmail={clinicaEmail}
                                                    clinicaSite={clinicaSite}
                                                  />
                                                );
                                                
                                                const blob = await pdf(pdfDoc).toBlob();
                                                const url = URL.createObjectURL(blob);
                                                const printWindow = window.open(url, '_blank');
                                                if (printWindow) {
                                                  printWindow.onload = () => {
                                                    setTimeout(() => {
                                                      printWindow.print();
                                                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                                                    }, 250);
                                                  };
                                                }
                                              } catch (error: any) {
                                                console.error('Erro ao visualizar atestado:', error);
                                                toast.error('Erro ao visualizar atestado');
                                              }
                                            }}
                                            sx={{ 
                                              cursor: 'pointer',
                                              '&:hover': {
                                                backgroundColor: 'info.light',
                                                color: 'info.main',
                                                borderColor: 'info.main',
                                              }
                                            }}
                                          />
                                        </Tooltip>
                                        {isAtestadoAvulso && (
                                          <Chip
                                            label="Atestado Fora do Atendimento"
                                            size="small"
                                            color="warning"
                                            variant="filled"
                                            sx={{ ml: 0.5, fontSize: '0.65rem', height: '20px' }}
                                          />
                                        )}
                                      </Box>
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
        {false && (
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
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ color: 'error.main', fontWeight: 600 }}>
                      ⚠️ Alergias a Medicamentos
                    </Typography>
                    <Button
                      variant="contained"
                      color="warning"
                      size="small"
                      startIcon={<WarningIcon />}
                      onClick={() => setOpenAlergiaModal(true)}
                    >
                      Gerenciar Alergias
                    </Button>
                  </Box>
                  
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Use o botão acima para cadastrar alergias com princípio ativo. Isso permite verificação automática durante prescrições.
                    </Typography>
                  </Alert>

                  {alergiasPaciente.length > 0 ? (
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                        Alergias Cadastradas ({alergiasPaciente.length}):
                      </Typography>
                      <List dense>
                        {alergiasPaciente.map((alergia) => (
                          <ListItem
                            key={alergia.id}
                            sx={{
                              border: '1px solid',
                              borderColor: 'error.main',
                              borderRadius: 1,
                              mb: 1,
                              bgcolor: 'error.light',
                              '&:hover': {
                                bgcolor: 'error.light',
                              },
                            }}
                            secondaryAction={
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={() => {
                                  setAlergiaParaExcluir(alergia);
                                  setOpenConfirmarExclusaoAlergia(true);
                                }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            }
                          >
                            <ListItemText
                              primary={
                                <Typography variant="body2" fontWeight="bold">
                                  {alergia.nomeMedicamento}
                                </Typography>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    <strong>Princípio Ativo:</strong> {alergia.principioAtivo}
                                  </Typography>
                                  {alergia.classeQuimica && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      <strong>Classe Química:</strong> {alergia.classeQuimica}
                                    </Typography>
                                  )}
                                  {alergia.excipientes && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      <strong>Excipientes:</strong> {alergia.excipientes}
                                    </Typography>
                                  )}
                                  {alergia.observacoes && (
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                      {alergia.observacoes}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  ) : (
                    <Alert severity="info">
                      <Typography variant="body2">
                        Nenhuma alergia cadastrada no novo sistema. Use o botão "Gerenciar Alergias" para cadastrar.
                      </Typography>
                    </Alert>
                  )}

                </Box>
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
        {activeTab === 2 && (
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
                              {!prescricao.invalidado && (
                                <Tooltip title="Invalidar prescrição">
                                  <IconButton
                                    size="small"
                                    color="warning"
                                    onClick={() => {
                                      setDocumentoParaInvalidar({ tipo: 'prescricao', id: prescricao.id });
                                      setOpenInvalidarModal(true);
                                    }}
                                    sx={{ ml: 1 }}
                                  >
                                    <WarningIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {prescricao.invalidado && (
                                <Chip
                                  label="INVALIDADO"
                                  size="small"
                                  color="error"
                                  sx={{ ml: 1 }}
                                />
                              )}
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

        {/* Aba de Atestados - Apenas consulta/histórico */}
        {activeTab === 3 && (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            {loadingAtestados ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                <CircularProgress />
              </Box>
            ) : atestadosError ? (
              <Alert severity="error">{atestadosError}</Alert>
            ) : atestados.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  Nenhum atestado encontrado
                </Typography>
              </Box>
            ) : (
              <List sx={{ width: '100%' }}>
                {atestados.map((atestado) => (
                  <React.Fragment key={atestado.id}>
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
                                Protocolo: {atestado.protocolo}
                              </Typography>
                              <Chip
                                label={atestado.doutor?.nome || 'N/A'}
                                size="small"
                                color="primary"
                                sx={{ ml: 2 }}
                              />
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="caption" color="text.secondary">
                                {moment(atestado.createdAt).format('DD/MM/YYYY [às] HH:mm')}
                              </Typography>
                              <Tooltip title="Visualizar atestado">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={async () => {
                                    try {
                                      const atestadoCompleto = await getAtestadoByProtocolo(atestado.protocolo);
                                      // Gerar PDF e abrir
                                      const { getDoutorById } = await import('../../services/doutor.service');
                                      const doutor = await getDoutorById(atestadoCompleto.doutorId);
                                      
                                      const clinicaNome = doutor.clinica?.nome || 'Clínica';
                                      const clinicaEndereco = doutor.clinica?.endereco || '';
                                      const clinicaTelefone = doutor.clinica?.telefone || '';
                                      const clinicaEmail = doutor.clinica?.email || doutor.email || '';
                                      const clinicaSite = doutor.clinica?.site || '';
                                      
                                      const horaAtendimento = atestadoCompleto.agendamento?.dataHora
                                        ? moment(atestadoCompleto.agendamento.dataHora).format('HH:mm')
                                        : moment(atestadoCompleto.createdAt).format('HH:mm');
                                      
                                      // Determinar tipo de afastamento: se tem horaInicial e horaFinal, é horas
                                      const tipoAfastamento = (atestadoCompleto.horaInicial && atestadoCompleto.horaFinal) ? 'horas' : (atestadoCompleto.diasAfastamento < 1 ? 'horas' : 'dias');
                                      
                                      // Usar data do atestado ou data de criação
                                      const dataAtestadoFormatada = atestadoCompleto.dataAtestado
                                        ? moment(atestadoCompleto.dataAtestado).format('YYYY-MM-DD')
                                        : moment(atestadoCompleto.createdAt).format('YYYY-MM-DD');
                                      
                                      const pdfDoc = (
                                        <AtestadoPdfView
                                          pacienteNome={atestadoCompleto.paciente?.nome || ''}
                                          pacienteCPF={atestadoCompleto.paciente?.cpf || undefined}
                                          dataAtendimento={dataAtestadoFormatada}
                                          horaAtendimento={horaAtendimento}
                                          diasAfastamento={atestadoCompleto.diasAfastamento}
                                          tipoAfastamento={tipoAfastamento}
                                          horaInicial={atestadoCompleto.horaInicial || undefined}
                                          horaFinal={atestadoCompleto.horaFinal || undefined}
                                          cid={atestadoCompleto.cid || undefined}
                                          exibirCid={atestadoCompleto.exibirCid}
                                          conteudo={atestadoCompleto.conteudo || ''}
                                          localAtendimento={atestadoCompleto.localAtendimento || 'Consultório'}
                                          doutorNome={doutor.nome || ''}
                                          doutorEspecialidade={doutor.especialidade || ''}
                                          doutorCRM={doutor.crm}
                                          doutorCRMUF={doutor.crmUf}
                                          doutorRQE={doutor.rqe}
                                          clinicaNome={clinicaNome}
                                          clinicaEndereco={clinicaEndereco}
                                          clinicaTelefone={clinicaTelefone}
                                          clinicaEmail={clinicaEmail}
                                          clinicaSite={clinicaSite}
                                          invalidado={atestadoCompleto.invalidado}
                                          motivoInvalidacao={atestadoCompleto.motivoInvalidacao || undefined}
                                        />
                                      );
                                      
                                      const blob = await pdf(pdfDoc).toBlob();
                                      const url = URL.createObjectURL(blob);
                                      const printWindow = window.open(url, '_blank');
                                      if (printWindow) {
                                        printWindow.onload = () => {
                                          setTimeout(() => {
                                            printWindow.print();
                                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                                          }, 250);
                                        };
                                      }
                                    } catch (error: any) {
                                      console.error('Erro ao visualizar atestado:', error);
                                      toast.error('Erro ao visualizar atestado');
                                    }
                                  }}
                                  sx={{ ml: 1 }}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {!atestado.invalidado && (
                                <Tooltip title="Invalidar atestado">
                                  <IconButton
                                    size="small"
                                    color="warning"
                                    onClick={() => {
                                      setDocumentoParaInvalidar({ tipo: 'atestado', id: atestado.id });
                                      setOpenInvalidarModal(true);
                                    }}
                                    sx={{ ml: 1 }}
                                  >
                                    <WarningIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {atestado.invalidado && (
                                <Chip
                                  label="INVALIDADO"
                                  size="small"
                                  color="error"
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box>
                            {atestado.agendamento && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                <strong>Agendamento:</strong> {moment(atestado.agendamento.dataHora).format('DD/MM/YYYY [às] HH:mm')} - {atestado.agendamento.servico?.nome}
                              </Typography>
                            )}
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                <strong>Afastamento:</strong> {atestado.diasAfastamento < 1 
                                  ? `${Math.floor(atestado.diasAfastamento * 24)} horas`
                                  : `${Math.floor(atestado.diasAfastamento)} dias`}
                              </Typography>
                              {atestado.cid && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                  <strong>CID:</strong> {atestado.exibirCid ? atestado.cid : 'Sob sigilo médico'}
                                </Typography>
                              )}
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                <strong>Local:</strong> {atestado.localAtendimento || 'Consultório'}
                              </Typography>
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            {atestado.conteudo && (
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
                                <strong>Observações:</strong> {atestado.conteudo}
                              </Typography>
                            )}
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

        {/* Aba de Alergias */}
        {activeTab === 4 && (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Alergias do Paciente</Typography>
              <Button
                variant="contained"
                startIcon={<AddCircleIcon />}
                onClick={() => setOpenAlergiaModal(true)}
              >
                Adicionar Alergia
              </Button>
            </Box>

            {alergiasPaciente.length === 0 ? (
              <Box textAlign="center" py={4}>
                <WarningIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  Nenhuma alergia cadastrada para este paciente
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddCircleIcon />}
                  onClick={() => setOpenAlergiaModal(true)}
                >
                  Cadastrar Primeira Alergia
                </Button>
              </Box>
            ) : (
              <List sx={{ width: '100%' }}>
                {alergiasPaciente.map((alergia) => (
                  <React.Fragment key={alergia.id}>
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        mb: 2,
                        p: 2,
                        backgroundColor: 'error.50',
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight="bold" component="span">
                                {alergia.nomeMedicamento || alergia.principioAtivo}
                              </Typography>
                              {alergia.medicamento && (
                                <Chip
                                  label="Medicamento cadastrado"
                                  size="small"
                                  color="primary"
                                  sx={{ ml: 2 }}
                                />
                              )}
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="caption" color="text.secondary">
                                {moment(alergia.createdAt).format('DD/MM/YYYY')}
                              </Typography>
                              <Tooltip title="Excluir alergia">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setAlergiaParaExcluir(alergia);
                                    setOpenConfirmarExclusaoAlergia(true);
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                <strong>Princípio Ativo:</strong> {alergia.principioAtivo}
                              </Typography>
                              {alergia.classeQuimica && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                  <strong>Classe Química:</strong> {alergia.classeQuimica}
                                </Typography>
                              )}
                              {alergia.excipientes && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                  <strong>Excipientes:</strong> {alergia.excipientes}
                                </Typography>
                              )}
                              {alergia.observacoes && (
                                <>
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
                                    <strong>Observações:</strong> {alergia.observacoes}
                                  </Typography>
                                </>
                              )}
                            </Box>
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

      {/* Modal de Alerta de Horário */}
      <Dialog
        open={openModalAlertaHorario}
        onClose={handleCancelarIniciarAtendimento}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <WarningIcon color="warning" />
            <Typography variant="h6" fontWeight="bold">
              Atenção: Horário Fora do Agendado
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {infoAlertaHorario && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body1" gutterBottom>
                  O atendimento está sendo iniciado <strong>{infoAlertaHorario.estaAtrasado ? 'atrasado' : 'adiantado'}</strong> em relação ao horário agendado.
                </Typography>
              </Alert>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Horário Agendado:</strong> {infoAlertaHorario.horarioAgendado}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Horário Atual:</strong> {moment().format('DD/MM/YYYY [às] HH:mm')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Diferença:</strong> {infoAlertaHorario.diferencaFormatada} ({infoAlertaHorario.diferencaMinutos} minutos)
                </Typography>
              </Box>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Deseja continuar e iniciar o atendimento mesmo assim?
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCancelarIniciarAtendimento}
            variant="outlined"
            color="inherit"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarIniciarApesarHorario}
            variant="contained"
            color="warning"
            startIcon={<PlayArrowIcon />}
          >
            Iniciar Mesmo Assim
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Pergunta sobre Alergias */}
      <Dialog
        open={openPerguntaAlergiaModal}
        onClose={() => setOpenPerguntaAlergiaModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            <Typography variant="h6">Alergia a Medicamentos</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            O paciente possui alguma alergia a algum medicamento?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenPerguntaAlergiaModal(false);
            }}
            variant="outlined"
          >
            Não
          </Button>
          <Button
            onClick={() => {
              setOpenPerguntaAlergiaModal(false);
              setOpenAlergiaModal(true);
            }}
            variant="contained"
            color="warning"
            startIcon={<WarningIcon />}
          >
            Sim
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Prescrição */}
      <Dialog 
        open={openPrescricaoModal} 
        onClose={() => {
          setOpenPrescricaoModal(false);
          setTextoPrescricao('');
          setMostrouPerguntaAlergia(false);
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
              setMostrouPerguntaAlergia(false);
            }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ overflow: 'visible' }}>
          {alergiasPaciente.length > 0 && (
            <Alert 
              severity="error" 
              icon={<WarningIcon />} 
              sx={{ 
                mb: 2,
                flexShrink: 0,
                '& .MuiAlert-message': {
                  width: '100%',
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>
                  Alergias Conhecidas ({alergiasPaciente.length}):
                </Typography>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 0.75,
                    maxHeight: 80,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pr: 0.5,
                    '&::-webkit-scrollbar': {
                      width: '6px',
                    },
                    '&::-webkit-scrollbar-track': {
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      borderRadius: '3px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      borderRadius: '3px',
                      '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.3)',
                      },
                    },
                  }}
                >
                  {alergiasPaciente.map((alergia) => (
                    <Chip
                      key={alergia.id}
                      label={alergia.principioAtivo || alergia.nomeMedicamento}
                      color="error"
                      size="small"
                      variant="outlined"
                      title={`${alergia.nomeMedicamento} - ${alergia.principioAtivo}${alergia.classeQuimica ? ` (Classe: ${alergia.classeQuimica})` : ''}`}
                      sx={{ 
                        fontWeight: 600,
                        borderWidth: 2,
                        flexShrink: 0,
                        '&:hover': {
                          backgroundColor: 'error.light',
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Alert>
          )}

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Paciente: <strong>{agendamento?.paciente.nome}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Data: <strong>{moment().format('DD/MM/YYYY')}</strong>
            </Typography>
          </Box>

          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<WarningIcon />}
              onClick={() => setOpenAlergiaModal(true)}
              disabled={!agendamento?.paciente}
            >
              Cadastrar Alergia
            </Button>
            <Button
              variant="outlined"
              startIcon={<MedicationIcon />}
              onClick={() => setOpenMedicamentoModal(true)}
            >
              Adicionar Medicamento
            </Button>
          </Box>
          
          <TextField
            label="Prescrição Médica"
            value={textoPrescricao}
            onChange={(e) => setTextoPrescricao(e.target.value)}
            fullWidth
            multiline
            rows={10}
            placeholder="Digite a prescrição médica aqui ou use a busca acima para adicionar medicamentos..."
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

                if (!agendamento.paciente) {
                  toast.error('Paciente não encontrado');
                  console.error('Paciente não encontrado');
                  return;
                }

                console.log('Todos os dados validados, salvando prescrição...');
                // Salvar prescrição no banco de dados
                // Se houver agendamento, vincular a prescrição ao atendimento
                try {
                  await createPrescricao({
                    conteudo: textoPrescricao.trim(),
                    pacienteId: agendamento.paciente.id,
                    doutorId: doutorAtual.id,
                    agendamentoId: agendamento.id, // Vincular prescrição ao atendimento quando criada durante um atendimento
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

      {/* Modal de Adicionar Medicamento */}
      <Dialog
        open={openMedicamentoModal}
        onClose={handleFecharModalMedicamento}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <MedicationIcon />
              <Typography variant="h6">Adicionar Medicamento</Typography>
            </Box>
            <IconButton onClick={handleFecharModalMedicamento}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {/* Filtros de Busca */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                value={buscaMedicamento}
                onChange={(e) => setBuscaMedicamento(e.target.value)}
                placeholder="Nome do Produto"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                value={buscaPrincipioAtivo}
                onChange={(e) => setBuscaPrincipioAtivo(e.target.value)}
                placeholder="Princípio Ativo"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ScienceIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                size="small"
                options={empresas}
                value={buscaEmpresa}
                onInputChange={(_, newValue) => setBuscaEmpresa(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Empresa (Farmacêutica)"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <BusinessIcon fontSize="small" />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                size="small"
                options={categorias}
                value={buscaCategoria}
                onInputChange={(_, newValue) => setBuscaCategoria(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Categoria Regulatória"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <CategoryIcon fontSize="small" />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            {(buscaMedicamento || buscaPrincipioAtivo || buscaEmpresa || buscaCategoria) && (
              <Grid item xs={12}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setBuscaMedicamento('');
                    setBuscaPrincipioAtivo('');
                    setBuscaEmpresa('');
                    setBuscaCategoria('');
                  }}
                >
                  Limpar Filtros
                </Button>
              </Grid>
            )}
          </Grid>

          {/* Lista de Resultados */}
          {loadingMedicamentos ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : medicamentosEncontrados.length > 0 ? (
            <Box sx={{ mb: 2, maxHeight: 300, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
              {medicamentosEncontrados.map((medicamento) => (
                <Box
                  key={medicamento.id}
                  onClick={() => {
                    setMedicamentoSelecionado(medicamento);
                    setBuscaMedicamento(medicamento.nomeProduto);
                  }}
                  sx={{
                    p: 1.5,
                    mb: 0.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: medicamentoSelecionado?.id === medicamento.id ? 'primary.light' : 'transparent',
                    '&:hover': {
                      bgcolor: medicamentoSelecionado?.id === medicamento.id ? 'primary.light' : 'grey.100',
                    },
                    border: medicamentoSelecionado?.id === medicamento.id ? '2px solid' : '1px solid',
                    borderColor: medicamentoSelecionado?.id === medicamento.id ? 'primary.main' : 'divider',
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {medicamento.nomeProduto}
                  </Typography>
                  {medicamento.principioAtivo && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {medicamento.principioAtivo.substring(0, 80)}
                      {medicamento.principioAtivo.length > 80 ? '...' : ''}
                    </Typography>
                  )}
                  {medicamento.empresaDetentoraRegistro && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {medicamento.empresaDetentoraRegistro}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          ) : (buscaMedicamento || buscaPrincipioAtivo || buscaEmpresa || buscaCategoria) ? (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Nenhum medicamento encontrado com os filtros aplicados.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Use os filtros acima para buscar medicamentos.
              </Typography>
            </Box>
          )}

          {/* Campos para adicionar medicamento selecionado */}
          {medicamentoSelecionado && (
            <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Medicamento Selecionado: {medicamentoSelecionado.nomeProduto}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Quantidade"
                    type="number"
                    value={quantidadeMedicamento}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      setQuantidadeMedicamento(Math.max(1, value));
                    }}
                    fullWidth
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Unidade</InputLabel>
                    <Select
                      value={unidadeMedicamento}
                      onChange={(e) => setUnidadeMedicamento(e.target.value as 'comprimidos' | 'caixa')}
                      label="Unidade"
                    >
                      <MenuItem value="caixa">Caixa</MenuItem>
                      <MenuItem value="comprimidos">Comprimidos</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {unidadeMedicamento === 'caixa' && (
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Comprimidos por caixa (opcional)"
                      type="number"
                      value={quantidadeComprimidos}
                      onChange={(e) => {
                        const value = e.target.value === '' ? '' : parseInt(e.target.value) || '';
                        setQuantidadeComprimidos(value);
                      }}
                      fullWidth
                      inputProps={{ min: 1 }}
                      placeholder="Ex: 60"
                      helperText="Opcional: quantidade de comprimidos na caixa"
                    />
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFecharModalMedicamento}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddCircleIcon />}
            onClick={handleAdicionarMedicamento}
            disabled={!medicamentoSelecionado}
          >
            Adicionar à Prescrição
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

      <PacienteFormModal
        open={openPacienteForm}
        onClose={() => setOpenPacienteForm(false)}
        initialData={agendamento?.paciente || null}
        onSubmit={handleSubmitPacienteModal}
        doutorIdForcado={agendamento?.doutor?.id}
      />

      {/* Modal de Atestado */}
      {agendamento?.paciente && (
        <AtestadoFormModal
          open={openAtestadoModal}
          onClose={() => setOpenAtestadoModal(false)}
          onSubmit={async (data) => {
            // Este onSubmit não será usado pois o modal já salva ao gerar PDF
            // Mas mantemos para compatibilidade
          }}
          atestado={null}
          pacientes={[agendamento.paciente]}
          agendamentoId={agendamento?.id} // Vincular ao agendamento atual
          ocultarCampoPaciente={true} // Ocultar campo de paciente pois já está vinculado ao atendimento
          onAtestadoCriado={async () => {
            // Recarregar lista de atestados
            if (agendamento?.paciente.id) {
              try {
                const data = await getAtestadosPaciente(agendamento.paciente.id);
                setAtestados(data);
              } catch (err: any) {
                console.error('Erro ao recarregar atestados:', err);
              }
            }
          }}
        />
      )}

      {/* Modal de Invalidação */}
      {documentoParaInvalidar && (
        <InvalidarDocumentoModal
          open={openInvalidarModal}
          onClose={() => {
            setOpenInvalidarModal(false);
            setDocumentoParaInvalidar(null);
          }}
          onConfirm={async (motivo) => {
            try {
              if (documentoParaInvalidar.tipo === 'prescricao') {
                await invalidatePrescricao(documentoParaInvalidar.id, motivo);
                toast.success('Prescrição invalidada com sucesso');
                // Recarregar prescrições
                if (agendamento?.paciente.id) {
                  const data = await getPrescricoesPaciente(agendamento.paciente.id);
                  setPrescricoes(data);
                }
              } else {
                await invalidateAtestado(documentoParaInvalidar.id, motivo);
                toast.success('Atestado invalidado com sucesso');
                // Recarregar atestados
                if (agendamento?.paciente.id) {
                  const data = await getAtestadosPaciente(agendamento.paciente.id);
                  setAtestados(data);
                }
              }
              setOpenInvalidarModal(false);
              setDocumentoParaInvalidar(null);
            } catch (error: any) {
              toast.error(error.response?.data?.error || 'Erro ao invalidar documento');
            }
          }}
          tipoDocumento={documentoParaInvalidar.tipo}
        />
      )}

      {/* Modal de Alergia */}
      <AlergiaFormModal
        open={openAlergiaModal}
        onClose={() => setOpenAlergiaModal(false)}
        paciente={agendamento?.paciente || null}
        onAlergiaCadastrada={async () => {
          if (agendamento?.paciente) {
            const alergias = await getAlergiasByPaciente(agendamento.paciente.id);
            setAlergiasPaciente(alergias);
          }
        }}
      />

      {/* Modal de Alerta de Alergia - Bloqueia prescrição */}
      {alergiaAlertaInfo && (
        <AlergiaAlertaModal
          open={openAlergiaAlertaModal}
          onClose={() => {
            setOpenAlergiaAlertaModal(false);
            setAlergiaAlertaInfo(null);
          }}
          medicamentoNome={alergiaAlertaInfo.medicamentoNome}
          verificacao={alergiaAlertaInfo.verificacao}
        />
      )}

      {/* Modal de Confirmação de Exclusão de Alergia */}
      <ConfirmarExclusaoAlergiaModal
        open={openConfirmarExclusaoAlergia}
        onClose={() => {
          setOpenConfirmarExclusaoAlergia(false);
          setAlergiaParaExcluir(null);
        }}
        onConfirm={async (justificativa) => {
          if (!alergiaParaExcluir) return;
          setLoadingExclusaoAlergia(true);
          try {
            await deleteAlergia(alergiaParaExcluir.id, justificativa);
            setAlergiasPaciente((prev) => prev.filter((a) => a.id !== alergiaParaExcluir.id));
            toast.success('Alergia removida com sucesso');
            setOpenConfirmarExclusaoAlergia(false);
            setAlergiaParaExcluir(null);
          } catch (error: any) {
            console.error('Erro ao remover alergia:', error);
            toast.error(error.response?.data?.message || 'Erro ao remover alergia');
          } finally {
            setLoadingExclusaoAlergia(false);
          }
        }}
        alergia={alergiaParaExcluir}
        loading={loadingExclusaoAlergia}
      />
    </>
  );
};
  
