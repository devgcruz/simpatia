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
  Divider,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
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
    pausaInicio: '',
    pausaFim: '',
    diasBloqueados: [] as number[],
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
      const { nome, email, especialidade = '', role, clinicaId, pausaInicio = '', pausaFim = '', diasBloqueados = [] } = initialData;
      setForm({
        nome,
        email,
        senha: '',
        especialidade,
        role,
        clinicaId: clinicaId != null ? String(clinicaId) : '',
        pausaInicio,
        pausaFim,
        diasBloqueados: diasBloqueados || [],
      });
    } else {
      setForm({
        nome: '',
        email: '',
        senha: '',
        especialidade: '',
        role: 'DOUTOR',
        clinicaId: '',
        pausaInicio: '',
        pausaFim: '',
        diasBloqueados: [],
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

  const handleDiaBloqueadoChange = (dia: number, checked: boolean) => {
    setForm((prev) => {
      const novosDiasBloqueados = checked
        ? [...prev.diasBloqueados, dia]
        : prev.diasBloqueados.filter((d) => d !== dia);
      return { ...prev, diasBloqueados: novosDiasBloqueados };
    });
  };

  const diasSemana = [
    { valor: 0, label: 'Domingo' },
    { valor: 1, label: 'Segunda-feira' },
    { valor: 2, label: 'Terça-feira' },
    { valor: 3, label: 'Quarta-feira' },
    { valor: 4, label: 'Quinta-feira' },
    { valor: 5, label: 'Sexta-feira' },
    { valor: 6, label: 'Sábado' },
  ];

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

          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>Horário de Almoço (Opcional)</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
            Defina o horário de almoço do doutor. Este horário aparecerá como "Horário da Pausa" no calendário do dashboard.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Início do Almoço"
              name="pausaInicio"
              value={form.pausaInicio}
              onChange={(e) => handleChange('pausaInicio', e.target.value)}
              type="time"
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
              helperText="Ex: 12:00"
            />
            <TextField
              label="Fim do Almoço"
              name="pausaFim"
              value={form.pausaFim}
              onChange={(e) => handleChange('pausaFim', e.target.value)}
              type="time"
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
              helperText="Ex: 13:00"
            />
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>Dias Bloqueados (Opcional)</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Selecione os dias da semana em que o doutor não atende. Estes dias aparecerão como indisponíveis no calendário.
          </Typography>
          <FormGroup>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {diasSemana.map((dia) => (
                <FormControlLabel
                  key={dia.valor}
                  control={
                    <Checkbox
                      checked={form.diasBloqueados.includes(dia.valor)}
                      onChange={(e) => handleDiaBloqueadoChange(dia.valor, e.target.checked)}
                    />
                  }
                  label={dia.label}
                />
              ))}
            </Box>
          </FormGroup>

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

