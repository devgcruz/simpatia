import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  CircularProgress,
  Grid,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Divider,
  Typography,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoIcon from '@mui/icons-material/Info';
import { toast } from 'sonner';
import { AgendamentoCreateInput } from '../../services/agendamento.service';
import { IDoutor, IPaciente, IServico, IAgendamento, IHistoricoPaciente } from '../../types/models';
import { getDoutores } from '../../services/doutor.service';
import { getPacientes, getPacienteHistoricos } from '../../services/paciente.service';
import { getServicos } from '../../services/servico.service';
import { useAuth } from '../../hooks/useAuth';
import moment from 'moment';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AgendamentoCreateInput) => void;
  initialData?: { dataHora: Date } | null;
  agendamento?: IAgendamento | null;
  onRequestDelete?: () => void;
  onFinalize?: (descricao: string) => Promise<void>;
}

const initialState = {
  dataHora: '',
  status: 'confirmado',
  pacienteId: '',
  doutorId: '',
  servicoId: '',
};

type FormState = typeof initialState;

export const AgendamentoFormModal: React.FC<Props> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  agendamento,
  onRequestDelete,
  onFinalize,
}) => {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);

  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [pacientes, setPacientes] = useState<IPaciente[]>([]);
  const [servicos, setServicos] = useState<IServico[]>([]);
  const [activeTab, setActiveTab] = useState<'dados' | 'historico'>('dados');
  const [historicos, setHistoricos] = useState<IHistoricoPaciente[]>([]);
  const [historicoSearch, setHistoricoSearch] = useState('');
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoError, setHistoricoError] = useState<string | null>(null);
  const [finalizacaoDescricao, setFinalizacaoDescricao] = useState('');
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [doutoresData, pacientesData, servicosData] = await Promise.all([
          getDoutores(),
          getPacientes(),
          getServicos(),
        ]);
        setDoutores(doutoresData);
        setPacientes(pacientesData);
        setServicos(servicosData);
      } catch (error) {
        toast.error('Erro ao carregar dados do formulário.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setActiveTab('dados');
    setFinalizacaoDescricao('');
    setHistoricoError(null);

    if (agendamento) {
      setForm({
        dataHora: moment(agendamento.dataHora).format('YYYY-MM-DDTHH:mm'),
        status: agendamento.status,
        pacienteId: String(agendamento.paciente.id),
        doutorId: String(agendamento.doutor.id),
        servicoId: String(agendamento.servico.id),
      });
      return;
    }

    if (initialData?.dataHora) {
      setForm({
        ...initialState,
        dataHora: moment(initialData.dataHora).format('YYYY-MM-DDTHH:mm'),
        doutorId: user?.role === 'DOUTOR' ? String(user.id) : '',
      });
    } else {
      setForm({
        ...initialState,
        doutorId: user?.role === 'DOUTOR' ? String(user.id) : '',
      });
    }
  }, [agendamento, initialData, user, open]);

  useEffect(() => {
    if (!open) {
      setHistoricos([]);
      return;
    }

    if (!agendamento) {
      setHistoricos([]);
      return;
    }

    const loadHistoricos = async () => {
      try {
        setHistoricoLoading(true);
        const data = await getPacienteHistoricos(agendamento.paciente.id);
        setHistoricos(data);
      } catch (error) {
        setHistoricoError('Erro ao carregar histórico do paciente.');
      } finally {
        setHistoricoLoading(false);
      }
    };

    loadHistoricos();
  }, [open, agendamento]);

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    if (!name) return;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (!name) return;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const filteredHistoricos = historicos.filter((historico) => {
    if (!historicoSearch.trim()) return true;
    const term = historicoSearch.trim().toLowerCase();
    return (
      historico.descricao.toLowerCase().includes(term) ||
      (historico.servico?.nome?.toLowerCase().includes(term) ?? false) ||
      (historico.doutor?.nome?.toLowerCase().includes(term) ?? false)
    );
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const dataToSend: AgendamentoCreateInput = {
      ...form,
      pacienteId: Number(form.pacienteId),
      doutorId: Number(form.doutorId || user?.id || 0),
      servicoId: Number(form.servicoId),
      dataHora: new Date(form.dataHora).toISOString(),
    };
    onSubmit(dataToSend);
  };

  const handleFinalizeConsulta = async () => {
    if (!onFinalize || !agendamento) return;
    try {
      setFinalizando(true);
      await onFinalize(finalizacaoDescricao.trim());
      setFinalizacaoDescricao('');
      setForm((prev) => ({ ...prev, status: 'finalizado' }));
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Erro ao finalizar consulta';
      toast.error(message);
    } finally {
      setFinalizando(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, value: 'dados' | 'historico') => {
    setActiveTab(value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            {agendamento ? 'Editar Agendamento' : 'Novo Agendamento Manual'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {agendamento && (
              <Tooltip title="Excluir agendamento">
                <span>
                  <IconButton
                    aria-label="Excluir agendamento"
                    onClick={onRequestDelete}
                    disabled={loading || finalizando}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip title="Fechar">
              <IconButton aria-label="Fechar" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent dividers>
          {agendamento && (
            <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
              <Tab value="dados" label="Dados do agendamento" />
              <Tab value="historico" label="Histórico do paciente" />
            </Tabs>
          )}

          {activeTab === 'dados' && (
            <Box>
              {loading ? (
                <CircularProgress />
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl fullWidth required margin="normal">
                      <InputLabel id="paciente-label">Paciente</InputLabel>
                      <Select
                        name="pacienteId"
                        labelId="paciente-label"
                        value={form.pacienteId}
                        label="Paciente"
                        onChange={handleSelectChange}
                        disabled={Boolean(agendamento)}
                      >
                        {pacientes.map((p) => (
                          <MenuItem key={p.id} value={p.id}>
                            {p.nome}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl fullWidth required margin="normal">
                      <InputLabel id="servico-label">Serviço</InputLabel>
                      <Select
                        name="servicoId"
                        labelId="servico-label"
                        value={form.servicoId}
                        label="Serviço"
                        onChange={handleSelectChange}
                      >
                        {servicos.map((s) => (
                          <MenuItem key={s.id} value={s.id}>
                            {s.nome} ({s.duracaoMin} min)
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl fullWidth required margin="normal">
                      <InputLabel id="doutor-label">Doutor</InputLabel>
                      <Select
                        name="doutorId"
                        labelId="doutor-label"
                        value={form.doutorId}
                        label="Doutor"
                        onChange={handleSelectChange}
                        disabled={user?.role === 'DOUTOR'}
                      >
                        {doutores.map((d) => (
                          <MenuItem key={d.id} value={d.id}>
                            {d.nome}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      name="dataHora"
                      label="Data e Hora"
                      type="datetime-local"
                      value={form.dataHora}
                      onChange={handleInputChange}
                      fullWidth
                      required
                      margin="normal"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required margin="normal">
                      <InputLabel id="status-label">Status</InputLabel>
                      <Select
                        name="status"
                        labelId="status-label"
                        value={form.status}
                        label="Status"
                        onChange={handleSelectChange}
                      >
                        <MenuItem value="confirmado">Confirmado</MenuItem>
                        <MenuItem value="pendente_ia">Pendente (IA)</MenuItem>
                        <MenuItem value="cancelado">Cancelado</MenuItem>
                        <MenuItem value="finalizado">Finalizado</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {agendamento && agendamento.relatoPaciente && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <TextField
                          label="Relato do Paciente"
                          value={agendamento.relatoPaciente}
                          fullWidth
                          multiline
                          minRows={2}
                          margin="normal"
                          disabled
                          sx={{ flex: 1 }}
                        />
                        {agendamento.entendimentoIA && (
                          <Tooltip
                            title={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                  Entendimento da IA:
                                </Typography>
                                <Typography variant="body2">{agendamento.entendimentoIA}</Typography>
                              </Box>
                            }
                            arrow
                            placement="top"
                          >
                            <IconButton
                              color="primary"
                              sx={{
                                mt: 2,
                                alignSelf: 'flex-start',
                              }}
                            >
                              <InfoIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Grid>
                  )}
                </Grid>
              )}
            </Box>
          )}

          {agendamento && activeTab === 'historico' && (
            <Box>
              {historicoLoading ? (
                <CircularProgress />
              ) : (
                <Box>
                  {historicoError && (
                    <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                      {historicoError}
                    </Typography>
                  )}
                  {!historicoError && historicos.length > 0 && (
                    <>
                      <TextField
                        label="Pesquisar histórico"
                        value={historicoSearch}
                        onChange={(event) => setHistoricoSearch(event.target.value)}
                        fullWidth
                        size="small"
                        variant="outlined"
                        placeholder="Busque por descrição, serviço ou profissional..."
                        sx={{ mb: 2 }}
                      />
                      <List dense sx={{ mb: 2, maxHeight: 320, overflowY: 'auto' }}>
                        {filteredHistoricos.length === 0 && (
                          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                            Nenhum registro encontrado para a busca.
                          </Typography>
                        )}
                        {filteredHistoricos.map((historico, index) => {
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
                                      <Typography variant="subtitle2">{`${servicoNome} • ${realizadoLabel}`}</Typography>
                                      {profissionalNome && (
                                        <Typography variant="caption" color="text.secondary">
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
                                    <Typography variant="body2" color="text.secondary">
                                      {historico.descricao}
                                    </Typography>
                                  }
                                />
                              </ListItem>
                              {index < filteredHistoricos.length - 1 && <Divider component="li" />}
                            </React.Fragment>
                          );
                        })}
                      </List>
                    </>
                  )}
                  {!historicoError && historicos.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Nenhum histórico encontrado para este paciente.
                    </Typography>
                  )}
                </Box>
              )}

              {onFinalize && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Registre o que foi realizado nesta consulta
                  </Typography>
                  <TextField
                    label="Resumo da consulta"
                    multiline
                    minRows={4}
                    fullWidth
                    value={finalizacaoDescricao}
                    onChange={(event) => setFinalizacaoDescricao(event.target.value)}
                    placeholder="Descreva procedimentos, medicamentos, recomendações..."
                    margin="normal"
                    disabled={agendamento.status === 'finalizado'}
                  />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {agendamento && onFinalize && (
            <Button
              onClick={handleFinalizeConsulta}
              color="success"
              variant="contained"
              disabled={
                finalizando ||
                !finalizacaoDescricao.trim() ||
                agendamento.status === 'finalizado'
              }
            >
              {finalizando ? 'Finalizando...' : 'Finalizar Consulta'}
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={loading || finalizando}>
            {agendamento ? 'Atualizar' : 'Salvar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

