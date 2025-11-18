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
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Divider,
  Chip,
  IconButton,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import moment from 'moment';
import { IPaciente, IDoutor } from '../../types/models';
import { getDoutores } from '../../services/doutor.service';
import { useAuth } from '../../hooks/useAuth';

moment.locale('pt-br');

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<IPaciente, 'id' | 'clinicaId'>) => void;
  initialData?: IPaciente | null;
}

const estadosBrasileiros = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const generos = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'];

export const PacienteFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData }) => {
  const { user } = useAuth();
  const isDoutor = user?.role === 'DOUTOR';
  
  const [form, setForm] = useState<Omit<IPaciente, 'id' | 'clinicaId'>>({
    nome: '',
    telefone: '',
    cpf: '',
    dataNascimento: '',
    genero: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    convenio: '',
    numeroCarteirinha: '',
    alergias: '',
    observacoes: '',
    doutorId: undefined,
    pesoKg: undefined,
    alturaCm: undefined,
  });
  const isEditing = !!initialData;
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [loadingDoutores, setLoadingDoutores] = useState(false);
  const [alergiasList, setAlergiasList] = useState<string[]>([]);
  const [novaAlergia, setNovaAlergia] = useState<string>('');

  useEffect(() => {
    if (open && !isDoutor) {
      // Carregar lista de doutores apenas se não for DOUTOR
      const carregarDoutores = async () => {
        try {
          setLoadingDoutores(true);
          const data = await getDoutores();
          setDoutores(data);
        } catch (error: any) {
          console.error('Erro ao carregar doutores:', error);
        } finally {
          setLoadingDoutores(false);
        }
      };
      carregarDoutores();
    }
  }, [open, isDoutor]);

  // Função para converter string de alergias em array
  const parseAlergias = (alergiasString: string): string[] => {
    if (!alergiasString || alergiasString.trim() === '') return [];
    return alergiasString
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
  };

  // Função para converter array de alergias em string
  const formatAlergias = (alergias: string[]): string => {
    return alergias.join(', ');
  };

  useEffect(() => {
    if (!open) {
      // Limpar estados quando o modal fechar
      setNovaAlergia('');
      return;
    }

    if (initialData) {
      const alergiasParsed = parseAlergias(initialData.alergias || '');
      setAlergiasList(alergiasParsed);
      setNovaAlergia('');
      setForm({
        nome: initialData.nome || '',
        telefone: initialData.telefone || '',
        cpf: initialData.cpf || '',
        dataNascimento: initialData.dataNascimento
          ? moment(initialData.dataNascimento).format('YYYY-MM-DD')
          : '',
        genero: initialData.genero || '',
        email: initialData.email || '',
        cep: initialData.cep || '',
        logradouro: initialData.logradouro || '',
        numero: initialData.numero || '',
        bairro: initialData.bairro || '',
        cidade: initialData.cidade || '',
        estado: initialData.estado || '',
        convenio: initialData.convenio || '',
        numeroCarteirinha: initialData.numeroCarteirinha || '',
        alergias: formatAlergias(alergiasParsed),
        observacoes: initialData.observacoes || '',
        doutorId: initialData.doutorId || undefined,
        pesoKg: initialData.pesoKg ?? undefined,
        alturaCm: initialData.alturaCm ?? undefined,
      });
    } else {
      // Se for DOUTOR e estiver criando novo paciente, vincular automaticamente
      const doutorIdInicial = isDoutor && user?.id ? user.id : undefined;
      setAlergiasList([]);
      setNovaAlergia('');
      setForm({
        nome: '',
        telefone: '',
        cpf: '',
        dataNascimento: '',
        genero: '',
        email: '',
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        convenio: '',
        numeroCarteirinha: '',
        alergias: '',
        observacoes: '',
        doutorId: doutorIdInicial,
        pesoKg: undefined,
        alturaCm: undefined,
      });
    }
  }, [initialData, open, isDoutor, user?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDoutorChange = (e: any) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, doutorId: value === '' ? undefined : Number(value) }));
  };

  const handleGeneroChange = (e: any) => {
    setForm((prev) => ({ ...prev, genero: e.target.value }));
  };

  const handleEstadoChange = (e: any) => {
    setForm((prev) => ({ ...prev, estado: e.target.value }));
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
      setForm((prev) => ({ ...prev, cpf: value }));
    }
  };

  // Função para formatar CPF para exibição
  const formatarCPFExibicao = (cpf: string) => {
    if (!cpf) return '';
    const apenasNumeros = cpf.replace(/\D/g, '');
    if (apenasNumeros.length <= 11) {
      return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  };

  const handleCEPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 8) {
      setForm((prev) => ({ ...prev, cep: value }));
    }
  };

  // Função para formatar CEP para exibição
  const formatarCEPExibicao = (cep: string) => {
    if (!cep) return '';
    const apenasNumeros = cep.replace(/\D/g, '');
    if (apenasNumeros.length <= 8) {
      return apenasNumeros.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    return cep;
  };

  const handleAddAlergia = () => {
    const alergiaTrimmed = novaAlergia.trim();
    if (alergiaTrimmed && !alergiasList.includes(alergiaTrimmed)) {
      const novasAlergias = [...alergiasList, alergiaTrimmed];
      setAlergiasList(novasAlergias);
      setForm((prev) => ({ ...prev, alergias: formatAlergias(novasAlergias) }));
      setNovaAlergia('');
    }
  };

  const handleRemoveAlergia = (alergiaToRemove: string) => {
    const novasAlergias = alergiasList.filter((a) => a !== alergiaToRemove);
    setAlergiasList(novasAlergias);
    setForm((prev) => ({ ...prev, alergias: formatAlergias(novasAlergias) }));
  };

  const handleKeyPressAlergia = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAlergia();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enviar CPF sem formatação (apenas números)
    // Se for DOUTOR e não estiver editando, garantir que o doutorId seja o ID do usuário logado
    const formData = {
      ...form,
      cpf: form.cpf ? form.cpf.replace(/\D/g, '') : '',
      cep: form.cep ? form.cep.replace(/\D/g, '') : '',
      alergias: formatAlergias(alergiasList), // Garantir que alergias estejam formatadas
      // Se for DOUTOR criando novo paciente, sempre vincular ao doutor logado
      doutorId: isDoutor && !isEditing && user?.id ? user.id : form.doutorId,
    };
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditing ? 'Editar Paciente' : 'Novo Paciente'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          {/* Dados de Identificação (Essenciais) */}
          <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
            1. Dados de Identificação
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                name="nome"
                label="Nome Completo"
                value={form.nome}
                onChange={handleChange}
                fullWidth
                required
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="cpf"
                label="CPF"
                value={formatarCPFExibicao(form.cpf || '')}
                onChange={handleCPFChange}
                fullWidth
                margin="normal"
                placeholder="000.000.000-00"
                inputProps={{ maxLength: 14 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                name="dataNascimento"
                label="Data de Nascimento"
                type="date"
                value={form.dataNascimento}
                onChange={handleChange}
                fullWidth
                margin="normal"
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="genero-select-label">Gênero/Sexo Biológico</InputLabel>
                <Select
                  labelId="genero-select-label"
                  id="genero-select"
                  value={form.genero || ''}
                  onChange={handleGeneroChange}
                  label="Gênero/Sexo Biológico"
                >
                  <MenuItem value="">
                    <em>Selecione</em>
                  </MenuItem>
                  {generos.map((genero) => (
                    <MenuItem key={genero} value={genero}>
                      {genero}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                name="telefone"
                label="Telefone (WhatsApp)"
                value={form.telefone}
                onChange={handleChange}
                fullWidth
                required
                margin="normal"
                placeholder="14999998888"
                helperText="Incluir DDI e DDD"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Peso (kg)"
                type="number"
                value={form.pesoKg ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    pesoKg: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
                fullWidth
                margin="normal"
                inputProps={{ step: '0.1', min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Altura (cm)"
                type="number"
                value={form.alturaCm ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    alturaCm: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
                fullWidth
                margin="normal"
                inputProps={{ step: '0.5', min: 0 }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Dados de Contacto */}
          <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
            2. Dados de Contacto
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                name="email"
                label="E-mail"
                type="email"
                value={form.email}
                onChange={handleChange}
                fullWidth
                margin="normal"
                placeholder="exemplo@email.com"
              />
            </Grid>
            {/* Campo Doutor só aparece se não for DOUTOR */}
            {!isDoutor && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="doutor-select-label">Doutor (Opcional)</InputLabel>
                  <Select
                    labelId="doutor-select-label"
                    id="doutor-select"
                    value={form.doutorId || ''}
                    onChange={handleDoutorChange}
                    label="Doutor (Opcional)"
                    disabled={loadingDoutores}
                  >
                    <MenuItem value="">
                      <em>Nenhum</em>
                    </MenuItem>
                    {doutores.map((doutor) => (
                      <MenuItem key={doutor.id} value={doutor.id}>
                        {doutor.nome} {doutor.especialidade ? `- ${doutor.especialidade}` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={4}>
              <TextField
                name="cep"
                label="CEP"
                value={formatarCEPExibicao(form.cep || '')}
                onChange={handleCEPChange}
                fullWidth
                margin="normal"
                placeholder="00000-000"
                inputProps={{ maxLength: 9 }}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                name="logradouro"
                label="Rua/Logradouro"
                value={form.logradouro}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                name="numero"
                label="Número"
                value={form.numero}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                name="bairro"
                label="Bairro"
                value={form.bairro}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                name="cidade"
                label="Cidade"
                value={form.cidade}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="estado-select-label">Estado (UF)</InputLabel>
                <Select
                  labelId="estado-select-label"
                  id="estado-select"
                  value={form.estado || ''}
                  onChange={handleEstadoChange}
                  label="Estado (UF)"
                >
                  <MenuItem value="">
                    <em>Selecione</em>
                  </MenuItem>
                  {estadosBrasileiros.map((estado) => (
                    <MenuItem key={estado} value={estado}>
                      {estado}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Dados Clínicos Básicos */}
          <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
            3. Dados Clínicos Básicos
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                name="convenio"
                label="Convênio/Plano de Saúde"
                value={form.convenio}
                onChange={handleChange}
                fullWidth
                margin="normal"
                placeholder="Ex: Unimed, Bradesco, Particular"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="numeroCarteirinha"
                label="Número da Carteirinha"
                value={form.numeroCarteirinha}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ mb: 1, mt: 2, color: 'error.main', fontWeight: 500 }}>
                Alergias (Campo crítico de alerta)
              </Typography>
              <TextField
                label="Adicionar Alergia"
                value={novaAlergia}
                onChange={(e) => setNovaAlergia(e.target.value)}
                fullWidth
                margin="normal"
                placeholder="Digite o nome da alergia (ex: Dipirona, Penicilina)"
                onKeyPress={handleKeyPressAlergia}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={handleAddAlergia}
                        disabled={!novaAlergia.trim() || alergiasList.includes(novaAlergia.trim())}
                        edge="end"
                        color="primary"
                        size="small"
                      >
                        <AddIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              {alergiasList.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, mb: 1 }}>
                  {alergiasList.map((alergia, index) => (
                    <Chip
                      key={index}
                      label={alergia}
                      onDelete={() => handleRemoveAlergia(alergia)}
                      deleteIcon={<CloseIcon />}
                      color="error"
                      variant="outlined"
                      sx={{ fontSize: '0.875rem' }}
                    />
                  ))}
                </Box>
              )}
              {alergiasList.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                  Nenhuma alergia cadastrada. Use o campo acima para adicionar alergias.
                </Typography>
              )}
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="observacoes"
                label="Histórico/Observações"
                value={form.observacoes}
                onChange={handleChange}
                fullWidth
                margin="normal"
                multiline
                rows={3}
                placeholder="Ex: Paciente prefere contato à tarde, histórico de..."
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
