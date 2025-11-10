import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from '@mui/material';
import { IPaciente } from '../../types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<IPaciente, 'id' | 'clinicaId'>) => void;
  initialData?: IPaciente | null;
}

export const PacienteFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData }) => {
  const [form, setForm] = useState<Omit<IPaciente, 'id' | 'clinicaId'>>({ nome: '', telefone: '' });
  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      const { nome, telefone } = initialData;
      setForm({ nome, telefone });
    } else {
      setForm({ nome: '', telefone: '' });
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

