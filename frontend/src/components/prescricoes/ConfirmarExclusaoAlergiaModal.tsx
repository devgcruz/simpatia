import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Alert,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { IAlergiaMedicamento } from '../../services/alergia.service';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (justificativa: string) => void;
  alergia: IAlergiaMedicamento | null;
  loading?: boolean;
}

export const ConfirmarExclusaoAlergiaModal: React.FC<Props> = ({
  open,
  onClose,
  onConfirm,
  alergia,
  loading = false,
}) => {
  const [justificativa, setJustificativa] = useState('');
  const [confirmado, setConfirmado] = useState(false);

  const handleClose = () => {
    setJustificativa('');
    setConfirmado(false);
    onClose();
  };

  const handleConfirm = () => {
    if (justificativa.trim() && confirmado) {
      onConfirm(justificativa.trim());
      setJustificativa('');
      setConfirmado(false);
    }
  };

  const podeConfirmar = justificativa.trim().length >= 10 && confirmado;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon color="warning" />
          <Typography variant="h6">Confirmar Exclusão de Alergia</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="bold">
            Atenção: Esta ação não pode ser desfeita.
          </Typography>
        </Alert>

        {alergia && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Alergia a ser excluída:
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {alergia.nomeMedicamento}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Princípio Ativo: {alergia.principioAtivo}
            </Typography>
          </Box>
        )}

        <TextField
          label="Justificativa da Exclusão"
          fullWidth
          multiline
          rows={4}
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          placeholder="Descreva o motivo da exclusão desta alergia (mínimo 10 caracteres)"
          required
          helperText={`${justificativa.length} caracteres (mínimo 10)`}
          error={justificativa.length > 0 && justificativa.length < 10}
          sx={{ mb: 2 }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              color="warning"
            />
          }
          label={
            <Typography variant="body2">
              Confirmo que desejo excluir esta alergia e que a justificativa fornecida é verdadeira
            </Typography>
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={!podeConfirmar || loading}
          startIcon={<WarningIcon />}
        >
          {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};





