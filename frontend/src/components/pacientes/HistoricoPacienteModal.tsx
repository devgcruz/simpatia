import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import moment from 'moment';
import { IPaciente, IHistoricoPaciente } from '../../types/models';
import { getPacienteHistoricos } from '../../services/paciente.service';

moment.locale('pt-br');

interface Props {
  open: boolean;
  onClose: () => void;
  paciente: IPaciente | null;
}

export const HistoricoPacienteModal: React.FC<Props> = ({ open, onClose, paciente }) => {
  const [historicos, setHistoricos] = useState<IHistoricoPaciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && paciente) {
      const carregarHistorico = async () => {
        try {
          setLoading(true);
          setError(null);
          const data = await getPacienteHistoricos(paciente.id);
          setHistoricos(data);
        } catch (err: any) {
          setError(err?.response?.data?.message ?? 'Não foi possível carregar o histórico.');
        } finally {
          setLoading(false);
        }
      };
      carregarHistorico();
    } else {
      setHistoricos([]);
      setError(null);
    }
  }, [open, paciente]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Histórico do Paciente
        {paciente && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {paciente.nome}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : historicos.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Nenhum histórico disponível para este paciente.
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 500, overflowY: 'auto' }}>
            {historicos.map((historico, index) => (
              <React.Fragment key={historico.id}>
                <ListItem alignItems="flex-start" disableGutters>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {historico.servico?.nome ?? 'Consulta'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {moment(historico.realizadoEm).format('DD/MM/YYYY HH:mm')}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        {historico.doutor?.nome && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            <strong>Profissional:</strong> {historico.doutor.nome}
                            {historico.doutor.email && ` (${historico.doutor.email})`}
                          </Typography>
                        )}
                        {historico.servico && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            <strong>Duração:</strong> {historico.servico.duracaoMin} minutos
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
                          {historico.descricao}
                        </Typography>
                        {historico.criadoEm && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            Registrado em: {moment(historico.criadoEm).format('DD/MM/YYYY HH:mm')}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
                {index < historicos.length - 1 && <Divider component="li" sx={{ my: 2 }} />}
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};


