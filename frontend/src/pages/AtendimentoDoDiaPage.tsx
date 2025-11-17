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
  const [agendamentoEditando, setAgendamentoEditando] = useState<IAgendamento | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [pacienteHistorico, setPacienteHistorico] = useState<IAgendamento | null>(null);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);

  // Se for DOUTOR, usar o próprio ID automaticamente
  const doutorIdParaBusca = isDoutor && user?.id ? user.id : (doutorSelecionado || '');

  // Calcular datas do dia atual no formato que o backend espera
  // Passar com hora explícita para evitar problemas de fuso horário
  const dataHoje = useMemo(() => {
    const inicioDia = moment().startOf('day').format('YYYY-MM-DDTHH:mm:ss');
    const fimDia = moment().endOf('day').format('YYYY-MM-DDTHH:mm:ss');
    return {
      inicio: inicioDia,
      fim: fimDia,
    };
  }, []);

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
      console.log('Buscando agendamentos com:', {
        doutorId: doutorIdParaBusca,
        dataInicio: dataHoje.inicio,
        dataFim: dataHoje.fim,
      });

      const data = await getAgendamentos({
        doutorId: doutorIdParaBusca,
        dataInicio: dataHoje.inicio,
        dataFim: dataHoje.fim,
      });

      console.log('Agendamentos retornados:', data);

      // Filtrar apenas agendamentos do dia atual e ordenar por horário
      const hoje = moment().startOf('day');
      const agendamentosHoje = data
        .filter((ag) => {
          const dataAgendamento = moment(ag.dataHora).startOf('day');
          const isSameDay = dataAgendamento.isSame(hoje, 'day');
          if (!isSameDay) {
            console.log('Agendamento filtrado (fora do dia):', {
              dataHora: ag.dataHora,
              dataAgendamento: dataAgendamento.format('YYYY-MM-DD'),
              hoje: hoje.format('YYYY-MM-DD'),
            });
          }
          return isSameDay;
        })
        .sort((a, b) => moment(a.dataHora).valueOf() - moment(b.dataHora).valueOf());

      console.log('Agendamentos do dia:', agendamentosHoje);
      setAgendamentos(agendamentosHoje);
    } catch (err: any) {
      console.error('Erro ao buscar agendamentos:', err);
      toast.error(err.response?.data?.message || 'Erro ao buscar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (doutorIdParaBusca && doutorIdParaBusca !== '') {
      fetchAgendamentos();
    }
  }, [doutorIdParaBusca]);

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

  const parseAlergias = (alergias: string | null | undefined): string[] => {
    if (!alergias || alergias.trim() === '') return [];
    return alergias
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
  };

  const agendamentosPassados = useMemo(() => {
    const agora = moment();
    return agendamentos.filter((ag) => moment(ag.dataHora).isBefore(agora));
  }, [agendamentos]);

  const agendamentosFuturos = useMemo(() => {
    const agora = moment();
    return agendamentos.filter((ag) => moment(ag.dataHora).isAfter(agora));
  }, [agendamentos]);

  const agendamentoAtual = useMemo(() => {
    const agora = moment();
    return agendamentos.find((ag) => {
      const inicio = moment(ag.dataHora);
      const fim = inicio.clone().add(ag.servico.duracaoMin, 'minutes');
      return agora.isBetween(inicio, fim, null, '[]');
    });
  }, [agendamentos]);

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
        elevation={2}
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TodayIcon sx={{ fontSize: 40 }} />
          <Box flex={1}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Atendimento do Dia
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {moment().format('dddd, DD [de] MMMM [de] YYYY')}
            </Typography>
          </Box>
          {!isDoutor && (
            <FormControl
              sx={{
                minWidth: 200,
                backgroundColor: 'white',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'transparent',
                  },
                },
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
          {/* Agendamento Atual */}
          {agendamentoAtual && (
            <Paper
              elevation={4}
              sx={{
                p: 3,
                mb: 3,
                border: `3px solid ${theme.palette.success.main}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.light, 0.05)} 100%)`,
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: theme.palette.success.main, width: 56, height: 56 }}>
                  <AccessTimeIcon />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    Em Atendimento Agora
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {moment(agendamentoAtual.dataHora).format('HH:mm')} -{' '}
                    {moment(agendamentoAtual.dataHora)
                      .add(agendamentoAtual.servico.duracaoMin, 'minutes')
                      .format('HH:mm')}
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <CardContent sx={{ p: 0 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      <PersonIcon color="primary" />
                      <Typography variant="h6">{agendamentoAtual.paciente.nome}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      <PhoneIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {agendamentoAtual.paciente.telefone}
                      </Typography>
                    </Stack>
                    {agendamentoAtual.paciente.alergias && parseAlergias(agendamentoAtual.paciente.alergias).length > 0 && (
                      <Stack direction="row" spacing={1} alignItems="center" mt={1} flexWrap="wrap">
                        <WarningIcon color="error" fontSize="small" />
                        <Typography variant="caption" color="error" fontWeight="bold">
                          Alergias:
                        </Typography>
                        {parseAlergias(agendamentoAtual.paciente.alergias).map((alergia, idx) => (
                          <Chip key={idx} label={alergia} size="small" color="error" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        ))}
                      </Stack>
                    )}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      <MedicalServicesIcon color="primary" />
                      <Typography variant="body1" fontWeight="medium">
                        {agendamentoAtual.servico.nome}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Duração: {agendamentoAtual.servico.duracaoMin} minutos
                    </Typography>
                    <Chip
                      label={getStatusLabel(agendamentoAtual.status)}
                      color={getStatusColor(agendamentoAtual.status)}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => handleEditAgendamento(agendamentoAtual)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<HistoryIcon />}
                    onClick={() => handleOpenHistorico(agendamentoAtual)}
                  >
                    Histórico
                  </Button>
                </Box>
              </CardContent>
            </Paper>
          )}

          {/* Agendamentos Futuros */}
          {agendamentosFuturos.length > 0 && (
            <Box mb={3}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 2 }}>
                Próximos Atendimentos ({agendamentosFuturos.length})
              </Typography>
              <Grid container spacing={2}>
                {agendamentosFuturos.map((agendamento) => (
                  <Grid item xs={12} sm={6} md={4} key={agendamento.id}>
                    <Card
                      elevation={2}
                      sx={{
                        height: '100%',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: theme.shadows[8],
                        },
                      }}
                    >
                      <CardContent>
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

                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => handleEditAgendamento(agendamento)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Ver Histórico">
                            <IconButton size="small" onClick={() => handleOpenHistorico(agendamento)}>
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Agendamentos Passados */}
          {agendamentosPassados.length > 0 && (
            <Box>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 2, color: 'text.secondary' }}>
                Atendimentos Realizados ({agendamentosPassados.length})
              </Typography>
              <Grid container spacing={2}>
                {agendamentosPassados.map((agendamento) => (
                  <Grid item xs={12} sm={6} md={4} key={agendamento.id}>
                    <Card
                      elevation={1}
                      sx={{
                        height: '100%',
                        opacity: 0.7,
                        backgroundColor: alpha(theme.palette.grey[300], 0.3),
                      }}
                    >
                      <CardContent>
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

                        <Stack spacing={1}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <MedicalServicesIcon fontSize="small" color="action" />
                            <Typography variant="body2">{agendamento.servico.nome}</Typography>
                          </Stack>
                          <Chip
                            label={getStatusLabel(agendamento.status)}
                            color={getStatusColor(agendamento.status)}
                            size="small"
                            sx={{ width: 'fit-content', mt: 0.5 }}
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {agendamentos.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <TodayIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Nenhum atendimento agendado para hoje
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Os agendamentos do dia aparecerão aqui quando forem criados.
              </Typography>
            </Paper>
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
    </Box>
  );
};

