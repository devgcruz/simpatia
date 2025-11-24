import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Avatar,
  Grid,
  Button,
  IconButton,
  Tooltip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  alpha,
  Stack,
  Tabs,
  Tab,
  TextField,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import TodayIcon from '@mui/icons-material/Today';
import PhoneIcon from '@mui/icons-material/Phone';
import WarningIcon from '@mui/icons-material/Warning';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment/locale/pt-br';
import { IAgendamento, IDoutor } from '../types/models';
import { getAgendamentos, updateAgendamento, createAgendamento, AgendamentoCreateInput } from '../services/agendamento.service';
import { getDoutores } from '../services/doutor.service';
import { useAuth } from '../hooks/useAuth';
import { AgendamentoFormModal } from '../components/agendamentos/AgendamentoFormModal';
import { HistoricoPacienteModal } from '../components/pacientes/HistoricoPacienteModal';
import { ProntuarioModal } from '../components/pacientes/ProntuarioModal';
import { finalizeAgendamento } from '../services/agendamento.service';

moment.locale('pt-br');

const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status) {
    case 'confirmado':
      return 'success';
    case 'pendente_ia':
      return 'warning';
    case 'finalizado':
      return 'info';
    case 'cancelado':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'confirmado':
      return 'Confirmado';
    case 'pendente_ia':
      return 'Pendente (IA)';
    case 'finalizado':
      return 'Finalizado';
    case 'cancelado':
      return 'Cancelado';
    default:
      return status;
  }
};

export const AtendimentoDoDiaPage: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const isDoutor = user?.role === 'DOUTOR';

  const [agendamentos, setAgendamentos] = useState<IAgendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [doutorSelecionado, setDoutorSelecionado] = useState<number | ''>('');
  const [dataSelecionada, setDataSelecionada] = useState<string>(moment().format('YYYY-MM-DD'));
  const [agendamentoEditando, setAgendamentoEditando] = useState<IAgendamento | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [pacienteHistorico, setPacienteHistorico] = useState<IAgendamento | null>(null);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [agendamentoProntuario, setAgendamentoProntuario] = useState<IAgendamento | null>(null);
  const [isProntuarioModalOpen, setIsProntuarioModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);

  // Se for DOUTOR, usar o próprio ID automaticamente
  const doutorIdParaBusca = isDoutor && user?.id ? user.id : (doutorSelecionado || '');

  // Calcular datas do dia selecionado no formato que o backend espera
  // Passar com hora explícita para evitar problemas de fuso horário
  const dataHoje = useMemo(() => {
    const dataSelecionadaMoment = moment(dataSelecionada);
    const inicioDia = dataSelecionadaMoment.startOf('day').format('YYYY-MM-DDTHH:mm:ss');
    const fimDia = dataSelecionadaMoment.endOf('day').format('YYYY-MM-DDTHH:mm:ss');
    return {
      inicio: inicioDia,
      fim: fimDia,
    };
  }, [dataSelecionada]);

  useEffect(() => {
    const carregarDoutores = async () => {
      if (!isDoutor) {
        try {
          const data = await getDoutores();
          setDoutores(data);
          if (data.length > 0 && !doutorSelecionado) {
            setDoutorSelecionado(data[0].id);
          }
        } catch (error: any) {
          toast.error('Erro ao carregar doutores');
        }
      } else if (isDoutor && user?.id) {
        // Se for DOUTOR, garantir que o ID esteja disponível
        // doutorIdParaBusca já será definido automaticamente
      }
    };

    carregarDoutores();
  }, [isDoutor, user?.id]);

  const fetchAgendamentos = async () => {
    if (!doutorIdParaBusca || doutorIdParaBusca === '') {
      setAgendamentos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getAgendamentos({
        doutorId: doutorIdParaBusca,
        dataInicio: dataHoje.inicio,
        dataFim: dataHoje.fim,
      });

      // Filtrar apenas agendamentos do dia selecionado, excluindo cancelados e pendentes, e ordenar por horário
      const dataSelecionadaMoment = moment(dataSelecionada).startOf('day');
      const agendamentosHoje = data
        .filter((ag) => {
          const dataAgendamento = moment(ag.dataHora).startOf('day');
          const isMesmoDia = dataAgendamento.isSame(dataSelecionadaMoment, 'day');
          const isStatusValido = ag.status !== 'cancelado' && ag.status !== 'pendente';
          return isMesmoDia && isStatusValido;
        })
        .sort((a, b) => moment(a.dataHora).valueOf() - moment(b.dataHora).valueOf());

      console.log('Total de agendamentos do dia:', agendamentosHoje.length);
      console.log('Agendamentos filtrados:', agendamentosHoje.map(ag => ({
        id: ag.id,
        paciente: ag.paciente.nome,
        dataHora: ag.dataHora,
        status: ag.status,
        servico: ag.servico.nome,
        duracao: ag.servico.duracaoMin
      })));

      setAgendamentos(agendamentosHoje);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (doutorIdParaBusca && doutorIdParaBusca !== '') {
      fetchAgendamentos();
    }
  }, [doutorIdParaBusca, dataSelecionada]);

  const handleEditAgendamento = (agendamento: IAgendamento) => {
    setAgendamentoEditando(agendamento);
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setAgendamentoEditando(null);
    setIsFormModalOpen(false);
    fetchAgendamentos();
  };

  const handleSubmitForm = async (data: AgendamentoCreateInput) => {
    try {
      if (agendamentoEditando) {
        await updateAgendamento(agendamentoEditando.id, data);
        toast.success('Agendamento atualizado com sucesso!');
      } else {
        await createAgendamento(data);
        toast.success('Agendamento criado com sucesso!');
      }
      await fetchAgendamentos();
      handleCloseFormModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar agendamento');
    }
  };

  const handleOpenHistorico = (agendamento: IAgendamento) => {
    setPacienteHistorico(agendamento);
    setIsHistoricoModalOpen(true);
  };

  const handleCloseHistorico = () => {
    setPacienteHistorico(null);
    setIsHistoricoModalOpen(false);
  };

  const handleOpenProntuario = (agendamento: IAgendamento) => {
    setAgendamentoProntuario(agendamento);
    setIsProntuarioModalOpen(true);
  };

  const handleCloseProntuario = () => {
    setAgendamentoProntuario(null);
    setIsProntuarioModalOpen(false);
  };

  const handleFinalizarConsulta = async (descricao: string, duracaoMinutos?: number) => {
    if (!agendamentoProntuario) return;
    try {
      await finalizeAgendamento(agendamentoProntuario.id, { descricao, duracaoMinutos });
      toast.success('Consulta finalizada com sucesso!', {
        duration: 3000,
      });
      await fetchAgendamentos();
      handleCloseProntuario();
    } catch (err: any) {
      throw err; // Re-throw para o modal tratar
    }
  };

  const parseAlergias = (alergias: string | null | undefined): string[] => {
    if (!alergias || alergias.trim() === '') return [];
    return alergias
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
  };

  const agendamentosPassados = useMemo(() => {
    const dataSelecionadaMoment = moment(dataSelecionada);
    const agora = moment();
    
    const passados = agendamentos
      .filter((ag) => {
        // Se está finalizado, sempre vai para realizados
        if (ag.status === 'finalizado') {
          return true;
        }
        // Senão, verificar se o horário já passou
        const inicio = moment(ag.dataHora);
        const fim = inicio.clone().add(ag.servico.duracaoMin, 'minutes');
        
        // Se a data selecionada é no passado, todos os agendamentos daquele dia são realizados
        if (dataSelecionadaMoment.isBefore(agora, 'day')) {
          return true;
        }
        // Se a data selecionada é hoje ou futura, verificar se o horário já passou
        return fim.isBefore(agora);
      })
      .sort((a, b) => moment(b.dataHora).valueOf() - moment(a.dataHora).valueOf()); // Mais recentes primeiro
    
    console.log('Agendamentos passados filtrados:', passados.length);
    console.log('Detalhes dos passados:', passados.map(ag => ({
      id: ag.id,
      paciente: ag.paciente.nome,
      status: ag.status,
      dataHora: ag.dataHora,
    })));
    
    return passados;
  }, [agendamentos, dataSelecionada]);

  const agendamentosFuturos = useMemo(() => {
    const dataSelecionadaMoment = moment(dataSelecionada);
    const agora = moment();
    
    return agendamentos.filter((ag) => {
      // Não incluir se está finalizado (já vai para realizados)
      if (ag.status === 'finalizado') {
        return false;
      }
      
      // Se a data selecionada é no passado, nenhum agendamento é futuro
      if (dataSelecionadaMoment.isBefore(agora, 'day')) {
        return false;
      }
      
      // Se a data selecionada é hoje ou futura, incluir apenas se ainda não terminou o horário
      const inicio = moment(ag.dataHora);
      const fim = inicio.clone().add(ag.servico.duracaoMin, 'minutes');
      return fim.isAfter(agora);
    });
  }, [agendamentos, dataSelecionada]);


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const doutorNome = isDoutor
    ? user?.email
    : doutores.find((d) => d.id === doutorSelecionado)?.nome || 'Selecione um doutor';

  return (
    <Box>
      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 3,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h5" fontWeight="bold">
              Atendimento do Dia
            </Typography>
            <TodayIcon color="primary" />
            <TextField
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Stack>
          {!isDoutor && (
            <FormControl
              sx={{
                minWidth: 200,
              }}
            >
              <InputLabel id="doutor-select-label">Doutor</InputLabel>
              <Select
                labelId="doutor-select-label"
                value={doutorSelecionado}
                label="Doutor"
                onChange={(e) => setDoutorSelecionado(e.target.value as number)}
              >
                {doutores.map((doutor) => (
                  <MenuItem key={doutor.id} value={doutor.id}>
                    {doutor.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </Paper>

      {!doutorIdParaBusca || doutorIdParaBusca === '' ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            {isDoutor ? 'Carregando informações...' : 'Selecione um doutor para ver os atendimentos do dia'}
          </Typography>
        </Paper>
      ) : (
        <>
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Tabs 
              value={activeTab} 
              onChange={(_, newValue) => setActiveTab(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab 
                label={`Próximos Atendimentos (${agendamentosFuturos.length})`} 
                sx={{ fontWeight: activeTab === 0 ? 600 : 400 }}
              />
              <Tab 
                label={`Atendimentos Realizados (${agendamentosPassados.length})`} 
                sx={{ fontWeight: activeTab === 1 ? 600 : 400 }}
              />
            </Tabs>
          </Paper>

          {/* Aba: Próximos Atendimentos */}
          {activeTab === 0 && (
            <>
              {agendamentosFuturos.length > 0 ? (
                <Grid container spacing={2}>
                {agendamentosFuturos.map((agendamento) => (
                  <Grid item xs={12} sm={6} md={4} key={agendamento.id}>
                    <Card
                      elevation={2}
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: theme.shadows[8],
                        },
                      }}
                      onClick={() => handleOpenProntuario(agendamento)}
                    >
                      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" spacing={2} alignItems="flex-start" mb={2}>
                          <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                            <PersonIcon />
                          </Avatar>
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                              {agendamento.paciente.nome}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                              <AccessTimeIcon fontSize="small" color="action" />
                              <Typography variant="body2" color="text.secondary">
                                {moment(agendamento.dataHora).format('HH:mm')}
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>

                        <Divider sx={{ my: 1.5 }} />

                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <Stack spacing={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <MedicalServicesIcon fontSize="small" color="action" />
                              <Typography variant="body2">{agendamento.servico.nome}</Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <PhoneIcon fontSize="small" color="action" />
                              <Typography variant="body2" color="text.secondary">
                                {agendamento.paciente.telefone}
                              </Typography>
                            </Stack>
                            {agendamento.paciente.alergias && parseAlergias(agendamento.paciente.alergias).length > 0 && (
                              <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                                <WarningIcon color="error" fontSize="small" />
                                <Typography variant="caption" color="error" fontWeight="bold">
                                  Alergias:
                                </Typography>
                                {parseAlergias(agendamento.paciente.alergias).slice(0, 2).map((alergia, idx) => (
                                  <Chip
                                    key={idx}
                                    label={alergia}
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                  />
                                ))}
                                {parseAlergias(agendamento.paciente.alergias).length > 2 && (
                                  <Typography variant="caption" color="text.secondary">
                                    +{parseAlergias(agendamento.paciente.alergias).length - 2}
                                  </Typography>
                                )}
                              </Stack>
                            )}
                            <Chip
                              label={getStatusLabel(agendamento.status)}
                              color={getStatusColor(agendamento.status)}
                              size="small"
                              sx={{ width: 'fit-content', mt: 0.5 }}
                            />
                          </Stack>
                        </Box>

                        <Box sx={{ mt: 'auto', pt: 2, display: 'flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<PersonIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProntuario(agendamento);
                            }}
                            fullWidth
                          >
                            Abrir Prontuário
                          </Button>
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditAgendamento(agendamento);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Ver Histórico">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenHistorico(agendamento);
                              }}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
                </Grid>
              ) : (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <AccessTimeIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Nenhum atendimento agendado para hoje.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Os agendamentos aparecerão aqui.
                  </Typography>
                </Paper>
              )}
            </>
          )}

          {/* Aba: Atendimentos Realizados */}
          {activeTab === 1 && (
            <>
              {agendamentosPassados.length > 0 ? (
                <Grid container spacing={2}>
                {agendamentosPassados.map((agendamento) => (
                  <Grid item xs={12} sm={6} md={4} key={agendamento.id}>
                    <Card
                      elevation={1}
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        opacity: 0.7,
                        backgroundColor: alpha(theme.palette.grey[300], 0.3),
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          opacity: 1,
                          transform: 'translateY(-2px)',
                          boxShadow: theme.shadows[4],
                        },
                      }}
                      onClick={() => handleOpenProntuario(agendamento)}
                    >
                      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" spacing={2} alignItems="flex-start" mb={2}>
                          <Avatar sx={{ bgcolor: theme.palette.grey[500] }}>
                            <PersonIcon />
                          </Avatar>
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                              {agendamento.paciente.nome}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                              <AccessTimeIcon fontSize="small" color="action" />
                              <Typography variant="body2" color="text.secondary">
                                {moment(agendamento.dataHora).format('HH:mm')}
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>

                        <Divider sx={{ my: 1.5 }} />

                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <Stack spacing={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <MedicalServicesIcon fontSize="small" color="action" />
                              <Typography variant="body2">{agendamento.servico.nome}</Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <PhoneIcon fontSize="small" color="action" />
                              <Typography variant="body2" color="text.secondary">
                                {agendamento.paciente.telefone}
                              </Typography>
                            </Stack>
                            <Chip
                              label={getStatusLabel(agendamento.status)}
                              color={getStatusColor(agendamento.status)}
                              size="small"
                              sx={{ width: 'fit-content', mt: 0.5 }}
                            />
                          </Stack>
                        </Box>

                        <Box sx={{ mt: 'auto', pt: 2, display: 'flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outlined"
                            color="primary"
                            size="small"
                            startIcon={<PersonIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProntuario(agendamento);
                            }}
                            fullWidth
                          >
                            Ver Prontuário
                          </Button>
                          <Tooltip title="Ver Histórico">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenHistorico(agendamento);
                              }}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
                </Grid>
              ) : (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <TodayIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Nenhum atendimento realizado ainda
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Os atendimentos realizados aparecerão aqui.
                  </Typography>
                </Paper>
              )}
            </>
          )}

        </>
      )}

      {/* Modal de Edição */}
      {agendamentoEditando && (
        <AgendamentoFormModal
          open={isFormModalOpen}
          onClose={handleCloseFormModal}
          onSubmit={handleSubmitForm}
          agendamento={agendamentoEditando}
          doutorId={agendamentoEditando.doutor.id}
        />
      )}

      {/* Modal de Histórico */}
      {pacienteHistorico && (
        <HistoricoPacienteModal
          open={isHistoricoModalOpen}
          onClose={handleCloseHistorico}
          paciente={pacienteHistorico.paciente}
        />
      )}

      {/* Modal de Prontuário */}
      {agendamentoProntuario && (
        <ProntuarioModal
          open={isProntuarioModalOpen}
          onClose={handleCloseProntuario}
          agendamento={agendamentoProntuario}
          onFinalizar={handleFinalizarConsulta}
        />
      )}
    </Box>
  );
};

