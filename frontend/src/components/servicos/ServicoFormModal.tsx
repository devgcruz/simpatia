import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from '@mui/material';
import { IServico } from '../../types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: IServico | null;
}

export const ServicoFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData }) => {
  const [form, setForm] = useState<any>({
    nome: '',
    descricao: '',
    duracaoMin: 30,
    preco: 100,
  });

  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm({ nome: '', descricao: '', duracaoMin: 30, preco: 100 });
    }
  }, [initialData, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev: any) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <TextField
            name="nome"
            label="Nome"
            value={form.nome}
            onChange={handleChange}
            fullWidth
            required
            margin="normal"
          />
          <TextField
            name="descricao"
            label="Descrição"
            value={form.descricao}
            onChange={handleChange}
            fullWidth
            margin="normal"
            multiline
            rows={3}
          />
          <TextField
            name="duracaoMin"
            label="Duração (minutos)"
            type="number"
            value={form.duracaoMin}
            onChange={handleChange}
            fullWidth
            required
            margin="normal"
          />
          <TextField
            name="preco"
            label="Preço (R$)"
            type="number"
            value={form.preco}
            onChange={handleChange}
            fullWidth
            required
            margin="normal"
          />
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
