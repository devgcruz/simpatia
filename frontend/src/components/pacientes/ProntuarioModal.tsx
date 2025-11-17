import React, { useState, useEffect, useRef } from 'react';
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
import { IAgendamento, IHistoricoPaciente, IPaciente, IDoutor } from '../../types/models';
import { getPacienteHistoricos, updatePaciente } from '../../services/paciente.service';
import { getDoutores } from '../../services/doutor.service';
import { useAuth } from '../../hooks/useAuth';
import moment from 'moment';
import 'moment/locale/pt-br';
import { toast } from 'sonner';

moment.locale('pt-br');

interface Props {
  open: boolean;
  onClose: () => void;
  agendamento: IAgendamento | null;
  onFinalizar?: (descricao: string) => Promise<void>;
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
  const [pacienteData, setPacienteData] = useState<Partial<IPaciente>>({});
  const [salvandoPaciente, setSalvandoPaciente] = useState(false);
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [alergiasList, setAlergiasList] = useState<string[]>([]);
  const [novaAlergia, setNovaAlergia] = useState<string>('');
  const intervalRef = useRef<number | null>(null);

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
      setOpenModalFinalizar(false);
    }
  }, [open]);


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

    try {
      setFinalizando(true);
      await onFinalizar(descricaoFinalizacao);
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

  if (!agendamento) return null;

  const porcentagemTempo = duracaoEsperadaSeg > 0 ? Math.min((tempoDecorrido / duracaoEsperadaSeg) * 100, 100) : 0;
  const tempoExcedido = tempoDecorrido > duracaoEsperadaSeg;
  const tempoFormatado = formatarTempo(tempoDecorrido);
  const tempoEsperadoFormatado = formatarTempo(duracaoEsperadaSeg);

  return (
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
          <Box flex={1}>
            <Typography variant="h5" fontWeight="bold">
              Prontuário do Paciente
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mt: 2 }}>
          <Tab label="Prontuário" />
          <Tab label="Histórico de Atendimentos" />
          <Tab label="Dados do Paciente" />
        </Tabs>
      </DialogTitle>
      <DialogContent 
        dividers
        sx={{
          flex: 1,
          overflow: activeTab === 0 || activeTab === 1 ? 'hidden' : 'auto',
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
                <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
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

          {/* Timer e Controles */}
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
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                  Tempo de Atendimento
                </Typography>

                <Box
                  sx={{
                    textAlign: 'center',
                    py: 2,
                    backgroundColor: tempoExcedido ? 'error.light' : 'transparent',
                    borderRadius: 2,
                    mb: 1.5,
                    border: tempoExcedido ? `2px solid ${tempoExcedido ? 'error.main' : 'primary.main'}` : 'none',
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    variant="h3"
                    fontWeight="bold"
                    color={tempoExcedido ? 'error.dark' : 'primary.dark'}
                    sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }}
                  >
                    {tempoFormatado}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Duração esperada: {tempoEsperadoFormatado}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1.5, flexShrink: 0 }}>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Progresso
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {porcentagemTempo.toFixed(0)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={porcentagemTempo}
                    color={tempoExcedido ? 'error' : 'primary'}
                    sx={{ height: 6, borderRadius: 4 }}
                  />
                </Box>

                {tempoExcedido && (
                  <Alert severity="warning" sx={{ mb: 1.5, py: 0.5, flexShrink: 0 }}>
                    <Typography variant="caption">Tempo de atendimento excedido!</Typography>
                  </Alert>
                )}

                <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ width: '100%' }}>
                  {!atendimentoIniciado && !inicioAtendimento && (
                    <Button
                      variant="contained"
                      color="success"
                      size="medium"
                      startIcon={<PlayArrowIcon />}
                      onClick={handleIniciarAtendimento}
                      disabled={agendamento.status === 'finalizado'}
                      fullWidth
                    >
                      Iniciar Atendimento
                    </Button>
                  )}

                  {atendimentoIniciado && (
                    <Button
                      variant="contained"
                      color="warning"
                      size="medium"
                      startIcon={<StopIcon />}
                      onClick={handlePausarAtendimento}
                      fullWidth
                    >
                      Pausar Atendimento
                    </Button>
                  )}

                  {!atendimentoIniciado && inicioAtendimento && (
                    <Button
                      variant="contained"
                      color="success"
                      size="medium"
                      startIcon={<PlayArrowIcon />}
                      onClick={handleRetomarAtendimento}
                      disabled={agendamento.status === 'finalizado'}
                      fullWidth
                    >
                      Retomar Atendimento
                    </Button>
                  )}
                </Stack>
                </Box>
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
            ) : historicos.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  Nenhum histórico disponível para este paciente.
                </Typography>
              </Box>
            ) : (
              <List sx={{ flex: 1, overflowY: 'auto' }}>
                {historicos.map((historico, index) => {
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

                  return (
                    <React.Fragment key={historico.id}>
                      <ListItem alignItems="flex-start" disableGutters>
                        <ListItemText
                          primary={
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {`${servicoNome} • ${realizadoLabel}`}
                              </Typography>
                              {profissionalNome && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {profissionalNome}
                                </Typography>
                              )}
                              {finalizadoLabel && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {`Finalizado em ${finalizadoLabel}`}
                                </Typography>
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              {historico.descricao}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {index < historicos.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  );
                })}
              </List>
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
      </DialogContent>
      <DialogActions sx={{ flexShrink: 0 }}>
        {agendamento && agendamento.status !== 'finalizado' && (
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<CheckCircleIcon />}
            onClick={handleAbrirModalFinalizar}
            fullWidth
            sx={{ mr: 2, ml: 2, mb: 1, mt: 1 }}
          >
            Finalizar Atendimento
          </Button>
        )}
      </DialogActions>

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
    </Dialog>
  );
};

