import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  IconButton,
  Autocomplete,
  Chip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ISecretaria, SecretariaCreateInput, SecretariaUpdateInput } from '../../services/secretaria.service';
import { getDoutores, IDoutor } from '../../services/doutor.service';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SecretariaCreateInput | SecretariaUpdateInput) => void;
  secretaria?: ISecretaria | null;
}

export const SecretariaFormModal: React.FC<Props> = ({ open, onClose, onSubmit, secretaria }) => {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    doutorIds: [] as number[],
  });
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [loadingDoutores, setLoadingDoutores] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEditing = !!secretaria;

  useEffect(() => {
    if (open) {
      const fetchDoutores = async () => {
        try {
          setLoadingDoutores(true);
          // Buscar apenas doutores (não secretárias)
          const allDoutores = await getDoutores();
          const doutoresFiltrados = allDoutores.filter((d) => d.role !== 'SECRETARIA');
          setDoutores(doutoresFiltrados);
        } catch (error: any) {
          toast.error('Erro ao carregar doutores');
        } finally {
          setLoadingDoutores(false);
        }
      };

      fetchDoutores();

      if (secretaria) {
        setForm({
          nome: secretaria.nome || '',
          email: secretaria.email || '',
          senha: '',
          doutorIds: secretaria.doutoresVinculados?.map((d) => d.id) || [],
        });
      } else {
        setForm({
          nome: '',
          email: '',
          senha: '',
          doutorIds: [],
        });
      }
    }
  }, [open, secretaria]);

  const handleChange = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.nome || !form.email) {
      toast.error('Nome e email são obrigatórios');
      return;
    }

    if (!isEditing && !form.senha) {
      toast.error('Senha é obrigatória para novos cadastros');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(form);
    } catch (error: any) {
      // Erro já tratado no componente pai
    } finally {
      setLoading(false);
    }
  };

  const doutoresSelecionados = doutores.filter((d) => form.doutorIds.includes(d.id));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {isEditing ? 'Editar Secretária' : 'Nova Secretária'}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent dividers>
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
            label={isEditing ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha'}
            type="password"
            value={form.senha}
            onChange={(e) => handleChange('senha', e.target.value)}
            fullWidth
            required={!isEditing}
            margin="normal"
            helperText={isEditing ? 'Deixe em branco se não quiser alterar a senha' : ''}
          />

          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Doutores Vinculados
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Selecione os doutores aos quais esta secretária terá acesso. A secretária poderá visualizar e gerenciar apenas os dados relacionados aos doutores selecionados.
            </Typography>

            {loadingDoutores ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Autocomplete
                multiple
                options={doutores}
                getOptionLabel={(option) => `${option.nome}${option.especialidade ? ` - ${option.especialidade}` : ''}`}
                value={doutoresSelecionados}
                onChange={(_, newValue) => {
                  handleChange('doutorIds', newValue.map((d) => d.id));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Selecionar Doutores"
                    placeholder="Selecione um ou mais doutores"
                    margin="normal"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={`${option.nome}${option.especialidade ? ` - ${option.especialidade}` : ''}`}
                      {...getTagProps({ index })}
                      key={option.id}
                    />
                  ))
                }
              />
            )}

            {form.doutorIds.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {form.doutorIds.length} doutor{form.doutorIds.length > 1 ? 'es' : ''} selecionado{form.doutorIds.length > 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};


