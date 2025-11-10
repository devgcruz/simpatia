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
  FormHelperText,
} from '@mui/material';
import { IDoutor, DoutorRole, IClinica } from '../../types/models';
import { IUser } from '../../context/types';
import { getClinicas } from '../../services/clinica.service';

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
    clinicaId: '',
  });

  const isEditing = !!initialData;
  const [clinicas, setClinicas] = useState<IClinica[]>([]);
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
      const { nome, email, especialidade = '', role, clinicaId } = initialData;
      setForm({
        nome,
        email,
        senha: '',
        especialidade,
        role,
        clinicaId: clinicaId != null ? String(clinicaId) : '',
      });
    } else {
      setForm({
        nome: '',
        email: '',
        senha: '',
        especialidade: '',
        role: 'DOUTOR',
        clinicaId: '',
      });
    }
  }, [initialData, open]);

  useEffect(() => {
    if (open && !isEditing && user?.role === 'SUPER_ADMIN') {
      const fetchClinicasParaSelect = async () => {
        try {
          const data = await getClinicas();
          setClinicas(data);
        } catch (error) {
          console.error("Erro ao buscar clínicas para o select:", error);
        }
      };
      fetchClinicasParaSelect();
    }
  }, [open, isEditing, user]);

  const handleChange = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = {
      ...form,
      clinicaId: form.clinicaId ? Number(form.clinicaId) : undefined,
    };

    if (isEditing && formData.senha === '') {
      const { senha, ...dataToSend } = formData;
      onSubmit(dataToSend);
    } else {
      onSubmit(formData);
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
          {!isEditing && user?.role === 'SUPER_ADMIN' && (
            <FormControl fullWidth margin="normal" required>
              <InputLabel id="clinica-select-label">Clínica</InputLabel>
              <Select
                labelId="clinica-select-label"
                value={form.clinicaId}
                label="Clínica"
                onChange={(event) => handleChange('clinicaId', event.target.value)}
              >
                <MenuItem value="" disabled>
                  <em>Selecione a clínica...</em>
                </MenuItem>
                {clinicas.map((clinica) => (
                  <MenuItem key={clinica.id} value={clinica.id}>
                    {clinica.nome}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>O Doutor será associado a esta clínica.</FormHelperText>
            </FormControl>
          )}
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

