import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import { IClinica } from '../../types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: IClinica | null;
}

export const ClinicaFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData }) => {
  const [form, setForm] = useState<any>({
    nome: '',
    cnpj: '',
    endereco: '',
    telefone: '',
    adminNome: '',
    adminEmail: '',
    adminSenha: '',
  });
  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setForm({
        nome: initialData.nome,
        cnpj: initialData.cnpj || '',
        endereco: initialData.endereco || '',
        telefone: initialData.telefone || '',
      });
    } else {
      setForm({
        nome: '',
        cnpj: '',
        endereco: '',
        telefone: '',
        adminNome: '',
        adminEmail: '',
        adminSenha: '',
      });
    }
  }, [initialData, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Editar Clínica' : 'Nova Clínica e Admin'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <Typography variant="h6">Dados da Clínica</Typography>
          <TextField name="nome" label="Nome da Clínica" value={form.nome} onChange={handleChange} fullWidth required margin="normal" />
          <TextField name="cnpj" label="CNPJ" value={form.cnpj} onChange={handleChange} fullWidth margin="normal" />
          <TextField name="endereco" label="Endereço" value={form.endereco} onChange={handleChange} fullWidth margin="normal" />
          <TextField name="telefone" label="Telefone" value={form.telefone} onChange={handleChange} fullWidth margin="normal" />

          {!isEditing && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6">Dados do Admin da Clínica</Typography>
              <TextField name="adminNome" label="Nome do Admin" value={form.adminNome} onChange={handleChange} fullWidth required margin="normal" />
              <TextField name="adminEmail" label="Email do Admin" type="email" value={form.adminEmail} onChange={handleChange} fullWidth required margin="normal" />
              <TextField name="adminSenha" label="Senha Provisória" type="password" value={form.adminSenha} onChange={handleChange} fullWidth required margin="normal" />
            </>
          )}
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

