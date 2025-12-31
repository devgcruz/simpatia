import React, { useState, useEffect } from 'react';
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
import { SelectChangeEvent } from '@mui/material/Select';
import { IServico, IDoutor } from '../../types/models';
import { getDoutores } from '../../services/doutor.service';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: IServico | null;
}

export const ServicoFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData }) => {
  const { user } = useAuth();
  const isDoctor = user?.role === 'DOUTOR';
  const [form, setForm] = useState<any>({
    nome: '',
    descricao: '',
    duracaoMin: 30,
    preco: 100,
    doutorId: '',
  });
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [loading, setLoading] = useState(false);

  const isEditing = !!initialData;

  useEffect(() => {
    if (open) {
      // Se for doutor, não precisa buscar lista de doutores
      if (isDoctor) {
        // Vincular automaticamente ao doutor logado
        if (user?.id) {
          setForm((prev: any) => ({
            ...prev,
            doutorId: user.id,
          }));
        }
      } else {
        // Apenas não-doutores precisam buscar lista de doutores
        const fetchDoutores = async () => {
          try {
            setLoading(true);
            const data = await getDoutores();
            setDoutores(data);
          } catch (error) {
            console.error('Erro ao buscar doutores:', error);
          } finally {
            setLoading(false);
          }
        };
        fetchDoutores();
      }
    }
  }, [open, isDoctor, user]);

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      // Se for doutor criando novo serviço, vincular automaticamente
      const defaultDoutorId = isDoctor && user?.id ? user.id : '';
      setForm({ nome: '', descricao: '', duracaoMin: 30, preco: 100, doutorId: defaultDoutorId });
    }
  }, [initialData, open, isDoctor, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev: any) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setForm((prev: any) => ({
      ...prev,
      [name]: value === '' ? '' : Number(value),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Se for doutor, garantir que o doutorId está definido
    if (isDoctor && user?.id) {
      form.doutorId = user.id;
    }
    // Validação apenas para não-doutores
    if (!isDoctor && !isEditing && !form.doutorId) {
      alert('Por favor, selecione um doutor.');
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          {/* Mostrar select de doutor apenas para não-doutores e quando não estiver editando */}
          {!isEditing && !isDoctor && (
            <FormControl fullWidth required margin="normal">
              <InputLabel>Doutor</InputLabel>
              <Select
                name="doutorId"
                value={form.doutorId?.toString() || ''}
                onChange={handleSelectChange}
                label="Doutor"
                disabled={loading}
              >
                {doutores.map((doutor) => (
                  <MenuItem key={doutor.id} value={doutor.id}>
                    {doutor.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
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
