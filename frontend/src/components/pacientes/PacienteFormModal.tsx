import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
} from '@mui/material';
import moment from 'moment';
import { IPaciente, IHistoricoPaciente } from '../../types/models';
import { getPacienteHistoricos } from '../../services/paciente.service';

moment.locale('pt-br');

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<IPaciente, 'id' | 'clinicaId'>) => void;
  initialData?: IPaciente | null;
}

export const PacienteFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData }) => {
  const [form, setForm] = useState<Omit<IPaciente, 'id' | 'clinicaId'>>({ nome: '', telefone: '' });
  const isEditing = !!initialData;
  const [historicos, setHistoricos] = useState<IHistoricoPaciente[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoError, setHistoricoError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      const { nome, telefone } = initialData;
      setForm({ nome, telefone });
    } else {
      setForm({ nome: '', telefone: '' });
    }
    if (initialData && open) {
      const carregarHistorico = async () => {
        try {
          setHistoricoLoading(true);
          setHistoricoError(null);
          const data = await getPacienteHistoricos(initialData.id);
          setHistoricos(data);
        } catch (error: any) {
          setHistoricoError(error?.response?.data?.message ?? 'Não foi possível carregar o histórico.');
        } finally {
          setHistoricoLoading(false);
        }
      };
      carregarHistorico();
    } else {
      setHistoricos([]);
    }
  }, [initialData, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Editar Paciente' : 'Novo Paciente'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <TextField
            name="nome"
            label="Nome Completo"
            value={form.nome}
            onChange={handleChange}
            fullWidth
            required
            margin="normal"
          />
          <TextField
            name="telefone"
            label="Telefone (ex: 14999998888)"
            value={form.telefone}
            onChange={handleChange}
            fullWidth
            required
            margin="normal"
            placeholder="Incluir DDI e DDD"
          />
          {isEditing && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Histórico do paciente
              </Typography>
              {historicoLoading ? (
                <CircularProgress size={24} />
              ) : historicoError ? (
                <Typography variant="body2" color="error">
                  {historicoError}
                </Typography>
              ) : historicos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum histórico disponível para este paciente.
                </Typography>
              ) : (
                <List dense sx={{ maxHeight: 240, overflowY: 'auto' }}>
                  {historicos.map((historico, index) => (
                    <React.Fragment key={historico.id}>
                      <ListItem alignItems="flex-start" disableGutters>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2">
                              {moment(historico.realizadoEm).format('DD/MM/YYYY HH:mm')} •{' '}
                              {historico.servico?.nome ?? 'Consulta'}
                            </Typography>
                          }
                          secondary={
                            <>
                              {historico.doutor?.nome && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Profissional: {historico.doutor.nome}
                                </Typography>
                              )}
                              <Typography variant="body2" color="text.secondary">
                                {historico.descricao}
                              </Typography>
                            </>
                          }
                        />
                      </ListItem>
                      {index < historicos.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained">
            Salvar
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

