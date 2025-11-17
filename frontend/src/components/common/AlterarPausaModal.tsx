import React, { useState, useEffect } from 'react';
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
import { criarExcecaoPausa, CreatePausaExcecaoInput } from '../../services/pausa-excecao.service';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: Date; // Data do evento de pausa clicado
  doutorId?: number; // Se fornecido, é pausa de doutor; senão, é pausa de clínica
  horarioInicioAtual?: string; // Horário atual da pausa (para pré-preencher)
  horarioFimAtual?: string; // Horário atual da pausa (para pré-preencher)
}

export const AlterarPausaModal: React.FC<Props> = ({
  open,
  onClose,
  onConfirm,
  data,
  doutorId,
  horarioInicioAtual,
  horarioFimAtual,
}) => {
  const [pausaInicio, setPausaInicio] = useState(horarioInicioAtual || '12:00');
  const [pausaFim, setPausaFim] = useState(horarioFimAtual || '13:00');
  const [loading, setLoading] = useState(false);

  // Atualizar estado quando os props mudarem ou quando o modal abrir
  useEffect(() => {
    if (open) {
      setPausaInicio(horarioInicioAtual || '12:00');
      setPausaFim(horarioFimAtual || '13:00');
      setLoading(false);
    }
  }, [open, horarioInicioAtual, horarioFimAtual]);

  const handleConfirm = async () => {
    // Validações
    if (!pausaInicio || !pausaFim) {
      toast.error('Por favor, preencha os horários de início e fim da pausa');
      return;
    }

    // Validar formato HH:MM
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(pausaInicio) || !timeRegex.test(pausaFim)) {
      toast.error('Formato de horário inválido. Use HH:MM (ex: 12:00)');
      return;
    }

    // Validar que o fim é depois do início
    const [inicioH, inicioM] = pausaInicio.split(':').map(Number);
    const [fimH, fimM] = pausaFim.split(':').map(Number);
    const inicioMinutos = inicioH * 60 + inicioM;
    const fimMinutos = fimH * 60 + fimM;

    if (fimMinutos <= inicioMinutos) {
      toast.error('O horário de fim deve ser após o horário de início');
      return;
    }

    try {
      setLoading(true);

      // Formatar data como YYYY-MM-DD (usar data local para evitar problemas de fuso horário)
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const dia = String(data.getDate()).padStart(2, '0');
      const dataFormatada = `${ano}-${mes}-${dia}`;

      const input: CreatePausaExcecaoInput = {
        data: dataFormatada,
        pausaInicio,
        pausaFim,
        ...(doutorId && { doutorId }),
      };

      await criarExcecaoPausa(input);
      toast.success('Horário de pausa alterado com sucesso!');
      
      onClose();
      setTimeout(() => {
        onConfirm();
      }, 200);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao alterar horário de pausa');
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="alterar-pausa-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="alterar-pausa-dialog-title">Alterar Horário de Pausa</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Deseja trocar o horário da pausa desse dia?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            <strong>Data:</strong> {formatarData(data)}
          </Typography>
          {doutorId && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              <strong>Doutor ID:</strong> {doutorId}
            </Typography>
          )}
          <TextField
            fullWidth
            label="Horário de Início da Pausa"
            type="time"
            value={pausaInicio}
            onChange={(e) => setPausaInicio(e.target.value)}
            sx={{ mb: 2 }}
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              step: 300, // 5 minutos
            }}
          />
          <TextField
            fullWidth
            label="Horário de Fim da Pausa"
            type="time"
            value={pausaFim}
            onChange={(e) => setPausaFim(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              step: 300, // 5 minutos
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} variant="contained" disabled={loading}>
          {loading ? 'Salvando...' : 'Confirmar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
