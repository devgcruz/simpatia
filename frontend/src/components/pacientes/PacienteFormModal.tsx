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
  Stepper,
  Step,
  StepLabel,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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
  doutorIdForcado?: number; // Para SECRETARIA: doutor selecionado na página
}

const estadosBrasileiros = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const generos = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'];

// Etapas do workflow
const steps = [
  'Dados Pessoais',
  'Contato e Endereço',
  'Informações Clínicas',
  'Alergias',
  'Restrições',
  'Revisão e Confirmação',
];

export const PacienteFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData, doutorIdForcado }) => {
  const { user } = useAuth();
  const isDoutor = user?.role === 'DOUTOR';
  const isSecretaria = user?.role === 'SECRETARIA';
  const isEditing = !!initialData;
  
  // Estado da etapa atual (apenas para novos cadastros)
  const [activeStep, setActiveStep] = useState(0);
  
  // Estados para perguntas obrigatórias
  const [temAlergia, setTemAlergia] = useState<string>('');
  const [temRestricao, setTemRestricao] = useState<string>('');
  
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
  
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [loadingDoutores, setLoadingDoutores] = useState(false);
  const [alergiasList, setAlergiasList] = useState<string[]>([]);
  const [novaAlergia, setNovaAlergia] = useState<string>('');
  const [restricoes, setRestricoes] = useState<string>('');

  useEffect(() => {
    if (open && !isDoutor) {
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
      setNovaAlergia('');
      setActiveStep(0);
      setTemAlergia('');
      setTemRestricao('');
      setRestricoes('');
      return;
    }

    if (initialData) {
      const alergiasParsed = parseAlergias(initialData.alergias || '');
      setAlergiasList(alergiasParsed);
      setTemAlergia(alergiasParsed.length > 0 ? 'sim' : 'nao');
      // Separar restrições de observações (assumindo que restrições estão no início de observacoes)
      const obs = initialData.observacoes || '';
      setRestricoes(obs);
      setTemRestricao(obs.trim() ? 'sim' : 'nao');
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
        doutorId: initialData.doutorId || (isSecretaria && doutorIdForcado ? doutorIdForcado : undefined),
        pesoKg: initialData.pesoKg ?? undefined,
        alturaCm: initialData.alturaCm ?? undefined,
      });
    } else {
      const doutorIdInicial = isDoutor && user?.id 
        ? user.id 
        : (isSecretaria && doutorIdForcado ? doutorIdForcado : undefined);
      setAlergiasList([]);
      setNovaAlergia('');
      setTemAlergia('');
      setTemRestricao('');
      setRestricoes('');
      setActiveStep(0);
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
        doutorId: isSecretaria && doutorIdForcado ? doutorIdForcado : doutorIdInicial,
        pesoKg: undefined,
        alturaCm: undefined,
      });
    }
  }, [initialData, open, isDoutor, isSecretaria, user?.id, doutorIdForcado]);

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

  // Validação de etapas
  const validarEtapa = (etapa: number): boolean => {
    switch (etapa) {
      case 0: // Dados Pessoais
        return !!(form.nome && form.telefone);
      case 1: // Contato e Endereço
        return true; // Opcional
      case 2: // Informações Clínicas
        return true; // Opcional
      case 3: // Alergias
        return temAlergia !== '' && (temAlergia === 'nao' || alergiasList.length > 0);
      case 4: // Restrições
        return temRestricao !== '' && (temRestricao === 'nao' || restricoes.trim().length > 0);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validarEtapa(activeStep)) {
      setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar todas as etapas antes de submeter
    if (!isEditing) {
      for (let i = 0; i < steps.length - 1; i++) {
        if (!validarEtapa(i)) {
          setActiveStep(i);
          return;
        }
      }
    }
    
    // Combinar restrições com observações
    const observacoesFinais = restricoes.trim() 
      ? (form.observacoes ? `${form.observacoes}\n\nRestrições: ${restricoes}` : `Restrições: ${restricoes}`)
      : form.observacoes;
    
    const formData = {
      ...form,
      cpf: form.cpf ? form.cpf.replace(/\D/g, '') : '',
      cep: form.cep ? form.cep.replace(/\D/g, '') : '',
      alergias: formatAlergias(alergiasList),
      observacoes: observacoesFinais,
      doutorId: isDoutor && !isEditing && user?.id 
        ? user.id 
        : (isSecretaria && !isEditing && doutorIdForcado ? doutorIdForcado : form.doutorId),
    };
    onSubmit(formData);
  };

  // Renderizar conteúdo da etapa
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Dados Pessoais
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Dados de Identificação
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
                  error={!form.nome && activeStep === 0}
                  helperText={!form.nome && activeStep === 0 ? 'Campo obrigatório' : ''}
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
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="genero-select-label">Gênero/Sexo Biológico</InputLabel>
                  <Select
                    labelId="genero-select-label"
                    value={form.genero || ''}
                    onChange={handleGeneroChange}
                    label="Gênero/Sexo Biológico"
                  >
                    <MenuItem value=""><em>Selecione</em></MenuItem>
                    {generos.map((genero) => (
                      <MenuItem key={genero} value={genero}>{genero}</MenuItem>
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
                  error={!form.telefone && activeStep === 0}
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
          </Box>
        );

      case 1: // Contato e Endereço
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Dados de Contato e Endereço
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
              {!isDoutor && !isSecretaria && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel id="doutor-select-label">Doutor (Opcional)</InputLabel>
                    <Select
                      labelId="doutor-select-label"
                      value={form.doutorId || ''}
                      onChange={handleDoutorChange}
                      label="Doutor (Opcional)"
                      disabled={loadingDoutores}
                    >
                      <MenuItem value=""><em>Nenhum</em></MenuItem>
                      {doutores.map((doutor) => (
                        <MenuItem key={doutor.id} value={doutor.id}>
                          {doutor.nome} {doutor.especialidade ? `- ${doutor.especialidade}` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {isSecretaria && doutorIdForcado && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Doutor"
                    value={doutores.find(d => d.id === doutorIdForcado)?.nome || 'Carregando...'}
                    fullWidth
                    margin="normal"
                    disabled
                    helperText="Doutor selecionado na página de pacientes"
                  />
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
                    value={form.estado || ''}
                    onChange={handleEstadoChange}
                    label="Estado (UF)"
                  >
                    <MenuItem value=""><em>Selecione</em></MenuItem>
                    {estadosBrasileiros.map((estado) => (
                      <MenuItem key={estado} value={estado}>{estado}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        );

      case 2: // Informações Clínicas
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Informações Clínicas Básicas
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
                <TextField
                  name="observacoes"
                  label="Observações Gerais"
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
          </Box>
        );

      case 3: // Alergias
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Alergias
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Esta informação é crítica para a segurança do paciente. Por favor, responda com atenção.
            </Alert>
            
            <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
              <FormLabel component="legend" required>
                O paciente possui alguma alergia?
              </FormLabel>
              <RadioGroup
                value={temAlergia}
                onChange={(e) => {
                  setTemAlergia(e.target.value);
                  if (e.target.value === 'nao') {
                    setAlergiasList([]);
                    setForm((prev) => ({ ...prev, alergias: '' }));
                  }
                }}
                row
              >
                <FormControlLabel value="sim" control={<Radio />} label="Sim" />
                <FormControlLabel value="nao" control={<Radio />} label="Não" />
              </RadioGroup>
            </FormControl>

            {temAlergia === 'sim' && (
              <Box>
                <Typography variant="body2" sx={{ mb: 2, color: 'error.main', fontWeight: 500 }}>
                  Descreva todas as alergias conhecidas:
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
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Por favor, adicione pelo menos uma alergia ou altere a resposta para "Não".
                  </Alert>
                )}
              </Box>
            )}

            {temAlergia === '' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Por favor, responda se o paciente possui alergias antes de continuar.
              </Alert>
            )}
          </Box>
        );

      case 4: // Restrições
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Restrições
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Informe sobre restrições médicas, físicas, medicamentosas ou outras limitações importantes.
            </Alert>
            
            <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
              <FormLabel component="legend" required>
                O paciente possui alguma restrição?
              </FormLabel>
              <RadioGroup
                value={temRestricao}
                onChange={(e) => {
                  setTemRestricao(e.target.value);
                  if (e.target.value === 'nao') {
                    setRestricoes('');
                  }
                }}
                row
              >
                <FormControlLabel value="sim" control={<Radio />} label="Sim" />
                <FormControlLabel value="nao" control={<Radio />} label="Não" />
              </RadioGroup>
            </FormControl>

            {temRestricao === 'sim' && (
              <Box>
                <TextField
                  label="Descreva as restrições"
                  value={restricoes}
                  onChange={(e) => setRestricoes(e.target.value)}
                  fullWidth
                  margin="normal"
                  multiline
                  rows={4}
                  placeholder="Ex: Restrição a medicamentos específicos, limitações físicas, condições médicas que requerem atenção especial..."
                  required
                  error={!restricoes.trim() && temRestricao === 'sim'}
                  helperText={!restricoes.trim() && temRestricao === 'sim' ? 'Por favor, descreva as restrições' : ''}
                />
              </Box>
            )}

            {temRestricao === '' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Por favor, responda se o paciente possui restrições antes de continuar.
              </Alert>
            )}
          </Box>
        );

      case 5: // Revisão e Confirmação
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Revisão dos Dados
            </Typography>
            <Alert severity="success" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon />
              Revise todas as informações antes de confirmar o cadastro.
            </Alert>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Nome Completo</Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>{form.nome || 'Não informado'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Telefone</Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>{form.telefone || 'Não informado'}</Typography>
              </Grid>
              {form.cpf && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">CPF</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{formatarCPFExibicao(form.cpf)}</Typography>
                </Grid>
              )}
              {form.dataNascimento && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Data de Nascimento</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {moment(form.dataNascimento).format('DD/MM/YYYY')}
                  </Typography>
                </Grid>
              )}
              {alergiasList.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="error.main" sx={{ fontWeight: 600 }}>Alergias</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    {alergiasList.map((alergia, index) => (
                      <Chip key={index} label={alergia} color="error" variant="outlined" />
                    ))}
                  </Box>
                </Grid>
              )}
              {temAlergia === 'nao' && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Alergias</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>Nenhuma alergia registrada</Typography>
                </Grid>
              )}
              {restricoes.trim() && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Restrições</Typography>
                  <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{restricoes}</Typography>
                </Grid>
              )}
              {temRestricao === 'nao' && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Restrições</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>Nenhuma restrição registrada</Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEditing ? 'Editar Paciente' : 'Novo Paciente - Cadastro por Etapas'}
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          {!isEditing && (
            <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 2 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}
          
          {!isEditing ? (
            <Box sx={{ minHeight: 400 }}>
              {renderStepContent(activeStep)}
            </Box>
          ) : (
            // Modo de edição: mostrar todos os campos em uma única tela
            <Box>
              {renderStepContent(0)}
              <Divider sx={{ my: 3 }} />
              {renderStepContent(1)}
              <Divider sx={{ my: 3 }} />
              {renderStepContent(2)}
              <Divider sx={{ my: 3 }} />
              <Box>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  Alergias
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
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {!isEditing && (
            <>
              <Button
                onClick={handleBack}
                disabled={activeStep === 0}
                startIcon={<ArrowBackIcon />}
              >
                Voltar
              </Button>
              <Box sx={{ flex: '1 1 auto' }} />
              {activeStep < steps.length - 1 ? (
                <Button
                  onClick={handleNext}
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  disabled={!validarEtapa(activeStep)}
                >
                  Próximo
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                >
                  Confirmar Cadastro
                </Button>
              )}
            </>
          )}
          {isEditing && (
            <>
              <Button onClick={onClose}>Cancelar</Button>
              <Button type="submit" variant="contained">
                Salvar Alterações
              </Button>
            </>
          )}
        </DialogActions>
      </Box>
    </Dialog>
  );
};
