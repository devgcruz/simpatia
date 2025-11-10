import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from '@mui/material';
import { IDoutor, DoutorRole } from '../../types/models';
import { IUser } from '../../context/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<IDoutor> & { senha?: string }) => void;
  initialData?: IDoutor | null;
  user: IUser | null;
}

const roles: DoutorRole[] = ['DOUTOR', 'CLINICA_ADMIN'];

export const DoutorFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData, user }) => {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    especialidade: '',
    role: 'DOUTOR' as DoutorRole,
  });

  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      const { nome, email, especialidade = '', role } = initialData;
      setForm({
        nome,
        email,
        senha: '',
        especialidade,
        role,
      });
    } else {
      setForm({
        nome: '',
        email: '',
        senha: '',
        especialidade: '',
        role: 'DOUTOR',
      });
    }
  }, [initialData, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name as string]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && form.senha === '') {
      const { senha, ...dataToSend } = form;
      onSubmit(dataToSend);
    } else {
      onSubmit(form);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Editar Doutor' : 'Novo Doutor'}</DialogTitle>
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
            name="email"
            label="Email"
            type="email"
            value={form.email}
            onChange={handleChange}
            fullWidth
            required
            margin="normal"
          />
          <TextField
            name="especialidade"
            label="Especialidade"
            value={form.especialidade}
            onChange={handleChange}
            fullWidth
            margin="normal"
          />
          {isEditing && user?.role === 'SUPER_ADMIN' && (
            <TextField
              name="clinica"
              label="Clínica (Apenas Leitura)"
              value={initialData?.clinica?.nome || 'N/A'}
              fullWidth
              margin="normal"
              disabled
              InputProps={{
                readOnly: true,
              }}
            />
          )}
          <FormControl fullWidth margin="normal">
            <InputLabel id="role-label">Permissão</InputLabel>
            <Select
              name="role"
              labelId="role-label"
              value={form.role}
              label="Permissão"
              onChange={handleChange}
            >
              {roles.map((role) => (
                <MenuItem key={role} value={role}>
                  {role}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            name="senha"
            label={isEditing ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha'}
            type="password"
            value={form.senha}
            onChange={handleChange}
            fullWidth
            margin="normal"
            required={!isEditing}
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

