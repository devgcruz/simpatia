import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

interface InvalidarDocumentoModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
  tipoDocumento: 'prescricao' | 'atestado';
}

export const InvalidarDocumentoModal: React.FC<InvalidarDocumentoModalProps> = ({
  open,
  onClose,
  onConfirm,
  tipoDocumento,
}) => {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!motivo.trim()) {
      setError('O motivo da invalidação é obrigatório');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onConfirm(motivo.trim());
      setMotivo('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao invalidar documento');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setMotivo('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon color="warning" />
          <Typography variant="h6" fontWeight="bold">
            Invalidar {tipoDocumento === 'prescricao' ? 'Prescrição' : 'Atestado'}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ao invalidar este documento, uma marca d'água "INVALIDADO" será adicionada permanentemente.
          Esta ação não pode ser desfeita.
        </Typography>
        <TextField
          label="Motivo da Invalidação"
          multiline
          rows={4}
          fullWidth
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            setError('');
          }}
          error={!!error}
          helperText={error || 'Informe o motivo da invalidação'}
          required
          disabled={loading}
          placeholder="Ex: Erro na prescrição, paciente não compareceu, etc."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="warning"
          disabled={loading || !motivo.trim()}
        >
          {loading ? 'Invalidando...' : 'Confirmar Invalidação'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

