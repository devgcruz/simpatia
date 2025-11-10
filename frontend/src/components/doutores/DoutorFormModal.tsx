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

export const DoutorFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData, user }) => {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    especialidade: '',
    role: 'DOUTOR' as DoutorRole,
  });

  const isEditing = !!initialData;
  let roles: DoutorRole[] = ['DOUTOR', 'CLINICA_ADMIN'];
  if (user?.role === 'SUPER_ADMIN') {
    roles = ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN'];
  }

  const roleOptions: DoutorRole[] = [...roles];
  if (initialData?.role && !roleOptions.includes(initialData.role)) {
    roleOptions.push(initialData.role);
  }
  if (!roleOptions.includes(form.role)) {
    roleOptions.push(form.role);
  }

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

  const handleChange = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
            label="Nome Completo"
            value={form.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            fullWidth
            required
            margin="normal"
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            fullWidth
            required
            margin="normal"
          />
          <TextField
            label="Especialidade"
            value={form.especialidade}
            onChange={(e) => handleChange('especialidade', e.target.value)}
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
              labelId="role-label"
              value={form.role}
              label="Permissão"
              onChange={(event) => handleChange('role', event.target.value)}
            >
              {roleOptions.map((role) => (
                <MenuItem key={role} value={role}>
                  {role}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={isEditing ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha'}
            type="password"
            value={form.senha}
            onChange={(e) => handleChange('senha', e.target.value)}
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

