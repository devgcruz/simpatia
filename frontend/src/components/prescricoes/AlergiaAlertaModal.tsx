import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Divider,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import BlockIcon from '@mui/icons-material/Block';
import { VerificacaoAlergia } from '../../services/alergia.service';

interface Props {
  open: boolean;
  onClose: () => void;
  medicamentoNome: string;
  verificacao: VerificacaoAlergia;
}

export const AlergiaAlertaModal: React.FC<Props> = ({
  open,
  onClose,
  medicamentoNome,
  verificacao,
}) => {
  let mensagemMotivo = '';
  let mensagemDetalhada = '';
  let severidade: 'error' | 'warning' = 'error';

  switch (verificacao.motivo) {
    case 'principio_ativo':
      mensagemMotivo = 'PRINCÍPIO ATIVO';
      mensagemDetalhada = `O paciente é alérgico ao princípio ativo "${verificacao.alergiaEncontrada?.principioAtivo}".\n\nEste medicamento contém o mesmo princípio ativo e NÃO DEVE ser prescrito.`;
      severidade = 'error';
      break;
    case 'classe_quimica':
      mensagemMotivo = 'REATIVIDADE CRUZADA (Classe Química)';
      mensagemDetalhada = `O paciente é alérgico a "${verificacao.alergiaEncontrada?.principioAtivo}" (classe: ${verificacao.alergiaEncontrada?.classeQuimica}).\n\nEste medicamento pertence à mesma classe química/farmacológica e pode causar reatividade cruzada.`;
      severidade = 'error';
      break;
    case 'excipiente':
      mensagemMotivo = 'EXCIPIENTE/ADITIVO';
      mensagemDetalhada = `O paciente é alérgico a um excipiente/aditivo presente neste medicamento.\n\nAlergia registrada: ${verificacao.alergiaEncontrada?.excipientes}`;
      severidade = 'error';
      break;
    case 'nome_comercial':
      mensagemMotivo = 'NOME COMERCIAL';
      mensagemDetalhada = `O paciente é alérgico a um medicamento com nome similar.\n\nAlergia registrada: ${verificacao.alergiaEncontrada?.principioAtivo}`;
      severidade = 'warning';
      break;
    default:
      mensagemMotivo = 'ALERGIA DETECTADA';
      mensagemDetalhada = `O paciente é alérgico a este medicamento ou a um componente relacionado.`;
      severidade = 'error';
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          border: severidade === 'error' ? '2px solid #d32f2f' : '2px solid #ed6c02',
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1.5}>
          {severidade === 'error' ? (
            <BlockIcon sx={{ color: 'error.main', fontSize: 32 }} />
          ) : (
            <WarningIcon sx={{ color: 'warning.main', fontSize: 32 }} />
          )}
          <Box>
            <Typography variant="h6" fontWeight="bold" color={severidade === 'error' ? 'error.main' : 'warning.main'}>
              ALERTA DE ALERGIA
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {mensagemMotivo}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity={severidade} icon={<WarningIcon />} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Medicamento: {medicamentoNome}
          </Typography>
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {mensagemDetalhada}
          </Typography>
        </Box>

        {verificacao.alergiaEncontrada && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Informações da Alergia Registrada:
              </Typography>
              <Box sx={{ pl: 2, mt: 1 }}>
                <Typography variant="body2">
                  <strong>Princípio Ativo:</strong> {verificacao.alergiaEncontrada.principioAtivo}
                </Typography>
                {verificacao.alergiaEncontrada.classeQuimica && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <strong>Classe Química:</strong> {verificacao.alergiaEncontrada.classeQuimica}
                  </Typography>
                )}
                {verificacao.alergiaEncontrada.excipientes && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <strong>Excipientes:</strong> {verificacao.alergiaEncontrada.excipientes}
                  </Typography>
                )}
              </Box>
            </Box>
          </>
        )}

        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight="bold">
            Este medicamento NÃO pode ser prescrito para este paciente.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          color={severidade === 'error' ? 'error' : 'warning'}
          fullWidth
          size="large"
          startIcon={<BlockIcon />}
        >
          Entendi - Não Prescrever
        </Button>
      </DialogActions>
    </Dialog>
  );
};

