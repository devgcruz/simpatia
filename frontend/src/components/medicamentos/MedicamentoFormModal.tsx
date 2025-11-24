import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Grid,
} from '@mui/material';
import { IMedicamento } from '../../types/models';
import { MedicamentoInput } from '../../services/medicamento.service';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<MedicamentoInput>) => void;
  initialData?: IMedicamento | null;
}

export const MedicamentoFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData }) => {
  const [form, setForm] = useState<Partial<MedicamentoInput>>({
    tipoProduto: '',
    nomeProduto: '',
    dataFinalizacaoProcesso: undefined,
    categoriaRegulatoria: '',
    numeroRegistroProduto: '',
    dataVencimentoRegistro: undefined,
    numeroProcesso: '',
    classeTerapeutica: '',
    empresaDetentoraRegistro: '',
    situacaoRegistro: '',
    principioAtivo: '',
  });

  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setForm({
        tipoProduto: initialData.tipoProduto || '',
        nomeProduto: initialData.nomeProduto || '',
        dataFinalizacaoProcesso: initialData.dataFinalizacaoProcesso || undefined,
        categoriaRegulatoria: initialData.categoriaRegulatoria || '',
        numeroRegistroProduto: initialData.numeroRegistroProduto || '',
        dataVencimentoRegistro: initialData.dataVencimentoRegistro || undefined,
        numeroProcesso: initialData.numeroProcesso || '',
        classeTerapeutica: initialData.classeTerapeutica || '',
        empresaDetentoraRegistro: initialData.empresaDetentoraRegistro || '',
        situacaoRegistro: initialData.situacaoRegistro || '',
        principioAtivo: initialData.principioAtivo || '',
      });
    } else {
      setForm({
        tipoProduto: '',
        nomeProduto: '',
        dataFinalizacaoProcesso: undefined,
        categoriaRegulatoria: '',
        numeroRegistroProduto: '',
        dataVencimentoRegistro: undefined,
        numeroProcesso: '',
        classeTerapeutica: '',
        empresaDetentoraRegistro: '',
        situacaoRegistro: '',
        principioAtivo: '',
      });
    }
  }, [initialData, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value || undefined,
    }));
  };

  const handleDateChange = (name: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [name]: value ? new Date(value).toISOString() : undefined,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nomeProduto) {
      alert('Por favor, preencha o nome do produto.');
      return;
    }

    // Converter strings vazias para undefined
    const cleanedForm = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        value === '' || value === null ? undefined : value,
      ])
    ) as Partial<MedicamentoInput>;

    onSubmit(cleanedForm);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditing ? 'Editar Medicamento' : 'Novo Medicamento'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                name="tipoProduto"
                label="Tipo de Produto"
                value={form.tipoProduto || ''}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="nomeProduto"
                label="Nome do Produto"
                value={form.nomeProduto || ''}
                onChange={handleChange}
                fullWidth
                required
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="dataFinalizacaoProcesso"
                label="Data Finalização Processo"
                type="date"
                value={
                  form.dataFinalizacaoProcesso
                    ? (typeof form.dataFinalizacaoProcesso === 'string'
                        ? form.dataFinalizacaoProcesso.split('T')[0]
                        : new Date(form.dataFinalizacaoProcesso).toISOString().split('T')[0])
                    : ''
                }
                onChange={(e) => handleDateChange('dataFinalizacaoProcesso', e.target.value)}
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="categoriaRegulatoria"
                label="Categoria Regulatória"
                value={form.categoriaRegulatoria || ''}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="numeroRegistroProduto"
                label="Número Registro Produto"
                value={form.numeroRegistroProduto || ''}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="dataVencimentoRegistro"
                label="Data Vencimento Registro"
                type="date"
                value={
                  form.dataVencimentoRegistro
                    ? (typeof form.dataVencimentoRegistro === 'string'
                        ? form.dataVencimentoRegistro.split('T')[0]
                        : new Date(form.dataVencimentoRegistro).toISOString().split('T')[0])
                    : ''
                }
                onChange={(e) => handleDateChange('dataVencimentoRegistro', e.target.value)}
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="numeroProcesso"
                label="Número Processo"
                value={form.numeroProcesso || ''}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="classeTerapeutica"
                label="Classe Terapêutica"
                value={form.classeTerapeutica || ''}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="empresaDetentoraRegistro"
                label="Empresa Detentora do Registro"
                value={form.empresaDetentoraRegistro || ''}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="situacaoRegistro"
                label="Situação do Registro"
                value={form.situacaoRegistro || ''}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="principioAtivo"
                label="Princípio Ativo"
                value={form.principioAtivo || ''}
                onChange={handleChange}
                fullWidth
                margin="normal"
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
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

