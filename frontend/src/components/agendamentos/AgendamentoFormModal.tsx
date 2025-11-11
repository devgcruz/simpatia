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
} from '@mui/material';
import { toast } from 'sonner';
import { AgendamentoCreateInput } from '../../services/agendamento.service';
import { IDoutor, IPaciente, IServico, IAgendamento } from '../../types/models';
import { getDoutores } from '../../services/doutor.service';
import { getPacientes } from '../../services/paciente.service';
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
}) => {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);

  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [pacientes, setPacientes] = useState<IPaciente[]>([]);
  const [servicos, setServicos] = useState<IServico[]>([]);

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

  const handleChange = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (!name) return;
    setForm((prev) => ({ ...prev, [name]: value as string }));
  };

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{agendamento ? 'Editar Agendamento' : 'Novo Agendamento Manual'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
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
                    onChange={handleChange}
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
                    onChange={handleChange}
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
                    onChange={handleChange}
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
                  onChange={handleChange}
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
                    onChange={handleChange}
                  >
                    <MenuItem value="confirmado">Confirmado</MenuItem>
                    <MenuItem value="pendente_ia">Pendente (IA)</MenuItem>
                    <MenuItem value="cancelado">Cancelado</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          {agendamento && (
            <Button onClick={onRequestDelete} color="error" disabled={loading}>
              Excluir
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={loading}>
            {agendamento ? 'Atualizar' : 'Salvar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

