import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Grid,
  Typography,
  Divider,
} from '@mui/material';
import { IMedicamento } from '../../types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  medicamento: IMedicamento | null;
}

export const MedicamentoViewModal: React.FC<Props> = ({ open, onClose, medicamento }) => {
  if (!medicamento) return null;

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Detalhes do Medicamento</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Tipo de Produto
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {medicamento.tipoProduto || '-'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Nome do Produto
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>
                {medicamento.nomeProduto || '-'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Número de Registro do Produto
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {medicamento.numeroRegistroProduto || '-'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Número do Processo
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {medicamento.numeroProcesso || '-'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Data de Finalização do Processo
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatDate(medicamento.dataFinalizacaoProcesso)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Data de Vencimento do Registro
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatDate(medicamento.dataVencimentoRegistro)}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Categoria Regulatória
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {medicamento.categoriaRegulatoria || '-'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Classe Terapêutica
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {medicamento.classeTerapeutica || '-'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Situação do Registro
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {medicamento.situacaoRegistro || '-'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Empresa Detentora do Registro
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {medicamento.empresaDetentoraRegistro || '-'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>
            <Grid item xs={12}>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                display="block" 
                gutterBottom
                sx={{ fontWeight: 600, fontSize: '0.875rem' }}
              >
                Princípio Ativo
              </Typography>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                <Typography 
                  variant="body1" 
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: 'text.primary',
                  }}
                >
                  {medicamento.principioAtivo || '-'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

