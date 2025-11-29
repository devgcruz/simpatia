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
  Tabs,
  Tab,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  IconButton,
  CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { IDoutor, DoutorRole, IClinica } from '../../types/models';
import { IUser } from '../../context/types';
import { getClinicas } from '../../services/clinica.service';
import { uploadLogo } from '../../services/upload.service';
import { toast } from 'sonner';
import { IModeloPrescricaoPDF, modeloPrescricaoPadrao } from '../../types/prescricao';
import { getHorariosByDoutor, createHorario, updateHorario, deleteHorario, Horario } from '../../services/horario.service';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<IDoutor> & { senha?: string }) => void | Promise<IDoutor | void>;
  initialData?: IDoutor | null;
  user: IUser | null;
}

export const DoutorFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData, user }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    especialidade: '',
    crm: '',
    crmUf: '',
    rqe: '',
    role: 'DOUTOR' as DoutorRole,
    clinicaId: '',
    pausaInicio: '',
    pausaFim: '',
    diasBloqueados: [] as number[],
    modeloPrescricao: '',
  });

  // Modelo de prescrição PDF editável
  const [modeloPrescricaoPDF, setModeloPrescricaoPDF] = useState<IModeloPrescricaoPDF>(modeloPrescricaoPadrao);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Horários de expediente por dia da semana
  const [horarios, setHorarios] = useState<Record<number, Partial<Horario & { diaSemana: number }>>>({});
  const [loadingHorarios, setLoadingHorarios] = useState(false);

  const isEditing = !!initialData;
  const [clinicas, setClinicas] = useState<IClinica[]>([]);
  let roles: DoutorRole[] = ['DOUTOR', 'CLINICA_ADMIN', 'SECRETARIA'];
  if (user?.role === 'SUPER_ADMIN') {
    roles = ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN', 'SECRETARIA'];
  }

  const roleOptions: DoutorRole[] = [...roles];
  if (initialData?.role && !roleOptions.includes(initialData.role)) {
    roleOptions.push(initialData.role);
  }
  if (!roleOptions.includes(form.role)) {
    roleOptions.push(form.role);
  }

  // Carregar horários quando estiver editando
  useEffect(() => {
    const loadHorarios = async () => {
      if (initialData && initialData.id && open) {
        setLoadingHorarios(true);
        try {
          const horariosExistentes = await getHorariosByDoutor(initialData.id);
          const horariosPorDia: Record<number, Partial<Horario & { diaSemana: number }>> = {};
          horariosExistentes.forEach(h => {
            if (h.ativo) {
              horariosPorDia[h.diaSemana] = {
                id: h.id,
                diaSemana: h.diaSemana,
                inicio: h.inicio,
                fim: h.fim,
                pausaInicio: h.pausaInicio,
                pausaFim: h.pausaFim,
                doutorId: h.doutorId,
                ativo: h.ativo,
              };
            }
          });
          setHorarios(horariosPorDia);
        } catch (err: any) {
          console.error('Erro ao carregar horários:', err);
          toast.error('Erro ao carregar horários de expediente');
        } finally {
          setLoadingHorarios(false);
        }
      } else {
        setHorarios({});
      }
    };
    loadHorarios();
  }, [initialData, open]);

  useEffect(() => {
    if (initialData) {
      const { nome, email, especialidade = '', crm = '', crmUf = '', rqe = '', role, clinicaId, pausaInicio = '', pausaFim = '', diasBloqueados = [], modeloPrescricao = '' } = initialData;
      setForm({
        nome,
        email,
        senha: '',
        especialidade,
        crm,
        crmUf,
        rqe,
        role,
        clinicaId: clinicaId != null ? String(clinicaId) : '',
        pausaInicio,
        pausaFim,
        diasBloqueados: diasBloqueados || [],
        modeloPrescricao: modeloPrescricao || '',
      });
      
      // Carregar modelo PDF se existir
      if (modeloPrescricao) {
        try {
          const modeloParsed = JSON.parse(modeloPrescricao) as IModeloPrescricaoPDF;
          setModeloPrescricaoPDF(modeloParsed);
          if (modeloParsed.logoUrl) {
            setLogoPreview(modeloParsed.logoUrl);
          }
        } catch (error) {
          // Se não for JSON válido, usar modelo padrão
          console.warn('Modelo de prescrição não é JSON válido, usando padrão');
          setModeloPrescricaoPDF(modeloPrescricaoPadrao);
        }
      } else {
        setModeloPrescricaoPDF(modeloPrescricaoPadrao);
      }
    } else {
      setForm({
        nome: '',
        email: '',
        senha: '',
        especialidade: '',
        crm: '',
        crmUf: '',
        rqe: '',
        role: 'DOUTOR',
        clinicaId: '',
        pausaInicio: '',
        pausaFim: '',
        diasBloqueados: [],
        modeloPrescricao: '',
      });
      setModeloPrescricaoPDF(modeloPrescricaoPadrao);
      setLogoPreview(null);
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

  const handleHorarioChange = (diaSemana: number, field: string, value: string) => {
    setHorarios((prev) => ({
      ...prev,
      [diaSemana]: {
        ...prev[diaSemana],
        diaSemana,
        [field]: value || null,
      },
    }));
  };

  const handleHorarioToggle = (diaSemana: number, enabled: boolean) => {
    if (enabled) {
      // Ativar horário com valores padrão se não existir
      setHorarios((prev) => ({
        ...prev,
        [diaSemana]: {
          ...prev[diaSemana],
          diaSemana,
          inicio: prev[diaSemana]?.inicio || '08:00',
          fim: prev[diaSemana]?.fim || '18:00',
        },
      }));
    } else {
      // Remover horário do estado (será deletado ao salvar)
      setHorarios((prev) => {
        const newHorarios = { ...prev };
        delete newHorarios[diaSemana];
        return newHorarios;
      });
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Converter modelo PDF para JSON antes de salvar
      const modeloPrescricaoJson = JSON.stringify(modeloPrescricaoPDF);
      
      const formData = {
        ...form,
        clinicaId: form.clinicaId ? Number(form.clinicaId) : undefined,
        modeloPrescricao: modeloPrescricaoJson,
      };

      // Salvar o doutor primeiro e obter o ID
      let doutorId: number | null = null;
      
      if (isEditing && initialData?.id) {
        doutorId = initialData.id;
        if (formData.senha === '') {
          const { senha, ...dataToSend } = formData;
          const resultado = await onSubmit(dataToSend);
          // Se retornou um doutor, usar o ID (caso contrário já temos initialData.id)
          if (resultado && typeof resultado === 'object' && 'id' in resultado) {
            doutorId = resultado.id as number;
          }
        } else {
          const resultado = await onSubmit(formData);
          if (resultado && typeof resultado === 'object' && 'id' in resultado) {
            doutorId = resultado.id as number;
          }
        }
      } else {
        // Para criação, precisamos obter o ID do doutor criado
        const resultado = await onSubmit(formData);
        // Se o onSubmit retornar o doutor, usar o ID
        if (resultado && typeof resultado === 'object' && 'id' in resultado) {
          doutorId = resultado.id as number;
        }
      }

      // Salvar/atualizar horários se temos um doutorId válido
      if (doutorId) {
        try {
          // Buscar horários existentes para comparar
          const horariosExistentes = await getHorariosByDoutor(doutorId);
          const horariosExistentesMap = new Map(horariosExistentes.map(h => [h.diaSemana, h]));

          // Processar cada dia da semana
          for (let dia = 0; dia <= 6; dia++) {
            const horarioAtual = horarios[dia];
            const horarioExistente = horariosExistentesMap.get(dia);

            if (horarioAtual && horarioAtual.inicio && horarioAtual.fim) {
              // Tem horário configurado
              if (horarioExistente) {
                // Atualizar horário existente
                await updateHorario(horarioExistente.id, {
                  inicio: horarioAtual.inicio,
                  fim: horarioAtual.fim,
                  pausaInicio: horarioAtual.pausaInicio || null,
                  pausaFim: horarioAtual.pausaFim || null,
                });
              } else {
                // Criar novo horário
                await createHorario({
                  diaSemana: dia,
                  inicio: horarioAtual.inicio,
                  fim: horarioAtual.fim,
                  pausaInicio: horarioAtual.pausaInicio || null,
                  pausaFim: horarioAtual.pausaFim || null,
                  doutorId: doutorId,
                });
              }
            } else if (horarioExistente) {
              // Remover horário (inativar)
              await deleteHorario(horarioExistente.id);
            }
          }
          toast.success('Horários de expediente salvos com sucesso!');
        } catch (err: any) {
          console.error('Erro ao salvar horários:', err);
          toast.error('Doutor salvo, mas houve erro ao salvar horários de expediente');
        }
      } else if (!isEditing) {
        // Se não conseguimos o ID na criação, informar que os horários precisam ser configurados depois
        toast.warning('Doutor criado. Configure os horários de expediente através da edição.');
      }
    } catch (err: any) {
      console.error('Erro ao salvar doutor:', err);
      toast.error(err.response?.data?.message || 'Erro ao salvar doutor');
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Apenas imagens são permitidas (JPEG, PNG, GIF, WEBP)');
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      // Criar preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Fazer upload
      const response = await uploadLogo(file);
      
      // URL completa incluindo o host
      const fullUrl = `${window.location.protocol}//${window.location.host}${response.url}`;
      setModeloPrescricaoPDF(prev => ({ ...prev, logoUrl: fullUrl }));
      toast.success('Logo enviado com sucesso!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao fazer upload do logo');
      setLogoPreview(null);
    } finally {
      setUploadingLogo(false);
      // Limpar input
      event.target.value = '';
    }
  };

  // Limpar preview quando fechar o modal
  useEffect(() => {
    if (!open) {
      setLogoPreview(null);
    }
  }, [open]);


  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditing ? 'Editar Doutor' : 'Novo Doutor'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs value={activeTab} onChange={(_e, newValue) => setActiveTab(newValue)}>
            <Tab label="Dados Gerais" />
            <Tab label="Expediente" />
            <Tab label="Modelo de Prescrição" />
          </Tabs>
        </Box>
        <DialogContent>
          {activeTab === 0 && (
            <Box>
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
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <TextField
              label="CRM"
              value={form.crm}
              onChange={(e) => handleChange('crm', e.target.value)}
              fullWidth
              margin="normal"
              placeholder="Ex: 123456"
              helperText="Número do Conselho Regional de Medicina"
            />
            <TextField
              label="UF do CRM"
              value={form.crmUf}
              onChange={(e) => handleChange('crmUf', e.target.value.toUpperCase())}
              fullWidth
              margin="normal"
              placeholder="Ex: SP"
              inputProps={{ maxLength: 2 }}
              helperText="Estado do registro"
            />
          </Box>
          <TextField
            label="RQE (Registro de Qualificação de Especialista)"
            value={form.rqe}
            onChange={(e) => handleChange('rqe', e.target.value)}
            fullWidth
            margin="normal"
            placeholder="Ex: 12345"
            helperText="Opcional - Necessário se o médico for especialista"
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
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Horário de Expediente
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure o horário de funcionamento do doutor para cada dia da semana. Os dias bloqueados não serão exibidos na agenda.
              </Typography>

              {loadingHorarios ? (
                <CircularProgress />
              ) : (
                <>
                  {diasSemana.map((dia) => {
                    const horario = horarios[dia.valor];
                    const diaBloqueado = form.diasBloqueados.includes(dia.valor);
                    const temHorario = !!horario && !!horario.inicio && !!horario.fim;

                    return (
                      <Accordion key={dia.valor} defaultExpanded={temHorario}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {dia.label}
                            </Typography>
                            {diaBloqueado && (
                              <Typography variant="caption" color="error" sx={{ ml: 'auto' }}>
                                DIA BLOQUEADO
                              </Typography>
                            )}
                            {!diaBloqueado && temHorario && (
                              <Typography variant="caption" color="success.main">
                                {horario.inicio} - {horario.fim}
                                {horario.pausaInicio && horario.pausaFim && ` (Pausa: ${horario.pausaInicio} - ${horario.pausaFim})`}
                              </Typography>
                            )}
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={!diaBloqueado && temHorario}
                                  onChange={(e) => {
                                    if (!diaBloqueado) {
                                      handleHorarioToggle(dia.valor, e.target.checked);
                                    }
                                  }}
                                  disabled={diaBloqueado}
                                />
                              }
                              label="Trabalha neste dia"
                            />
                            {!diaBloqueado && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Marque os dias bloqueados na aba "Dados Gerais" para que não apareçam na agenda.
                              </Typography>
                            )}

                            {!diaBloqueado && temHorario && (
                              <Grid container spacing={2} sx={{ mt: 1 }}>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    label="Horário de Início"
                                    type="time"
                                    value={horario.inicio || ''}
                                    onChange={(e) => handleHorarioChange(dia.valor, 'inicio', e.target.value)}
                                    fullWidth
                                    required
                                    InputLabelProps={{ shrink: true }}
                                    helperText="Ex: 08:00"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    label="Horário de Fim"
                                    type="time"
                                    value={horario.fim || ''}
                                    onChange={(e) => handleHorarioChange(dia.valor, 'fim', e.target.value)}
                                    fullWidth
                                    required
                                    InputLabelProps={{ shrink: true }}
                                    helperText="Ex: 18:00"
                                  />
                                </Grid>
                                <Grid item xs={12}>
                                  <Divider sx={{ my: 2 }} />
                                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    Pausa de Almoço (Opcional)
                                  </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    label="Início da Pausa"
                                    type="time"
                                    value={horario.pausaInicio || ''}
                                    onChange={(e) => handleHorarioChange(dia.valor, 'pausaInicio', e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    helperText="Ex: 12:00"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    label="Fim da Pausa"
                                    type="time"
                                    value={horario.pausaFim || ''}
                                    onChange={(e) => handleHorarioChange(dia.valor, 'pausaFim', e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    helperText="Ex: 13:00"
                                  />
                                </Grid>
                              </Grid>
                            )}

                            {diaBloqueado && (
                              <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                                <Typography variant="body2" color="warning.dark">
                                  Este dia está bloqueado. Desmarque na aba "Dados Gerais" para configurar o horário.
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </>
              )}
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Modelo de Prescrição PDF
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure o modelo de prescrição PDF editável. O logo será exibido como marca d'água no centro do documento.
              </Typography>

              {/* Upload de Logo */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight="bold">Logo (Marca d'água)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Box sx={{ mb: 2 }}>
                        <input
                          accept="image/*"
                          style={{ display: 'none' }}
                          id="logo-upload-input"
                          type="file"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                        />
                        <label htmlFor="logo-upload-input">
                          <Button
                            variant="outlined"
                            component="span"
                            startIcon={<CloudUploadIcon />}
                            disabled={uploadingLogo}
                            fullWidth
                            sx={{ mb: 2 }}
                          >
                            {uploadingLogo ? 'Enviando...' : modeloPrescricaoPDF.logoUrl ? 'Alterar Logo' : 'Fazer Upload do Logo'}
                          </Button>
                        </label>
                        {(logoPreview || modeloPrescricaoPDF.logoUrl) && (
                          <Box sx={{ mt: 2, textAlign: 'center' }}>
                            <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                              {logoPreview ? 'Preview:' : 'Logo atual:'}
                            </Typography>
                            <Box sx={{ position: 'relative', display: 'inline-block' }}>
                              <Box
                                component="img"
                                src={logoPreview || modeloPrescricaoPDF.logoUrl}
                                alt="Logo"
                                sx={{
                                  maxWidth: '300px',
                                  maxHeight: '100px',
                                  border: '1px solid #e0e0e0',
                                  borderRadius: 1,
                                  p: 1,
                                  backgroundColor: '#f5f5f5',
                                }}
                                onError={() => {
                                  setModeloPrescricaoPDF(prev => ({ ...prev, logoUrl: '' }));
                                  toast.error('Erro ao carregar o logo. Por favor, faça upload novamente.');
                                }}
                              />
                              <IconButton
                                onClick={() => {
                                  const fileInput = document.getElementById('logo-upload-input') as HTMLInputElement;
                                  if (fileInput) {
                                    fileInput.value = '';
                                  }
                                  setLogoPreview(null);
                                  setModeloPrescricaoPDF(prev => ({ ...prev, logoUrl: '' }));
                                  toast.success('Logo removido');
                                }}
                                sx={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  backgroundColor: 'error.main',
                                  color: 'white',
                                  '&:hover': {
                                    backgroundColor: 'error.dark',
                                  },
                                  width: 32,
                                  height: 32,
                                  boxShadow: 2,
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                              O logo aparecerá como marca d'água no centro da prescrição (opacidade: {Math.round(modeloPrescricaoPDF.logoWatermark.opacity * 100)}%)
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.logoWatermark.enabled}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              logoWatermark: { ...prev.logoWatermark, enabled: e.target.checked }
                            }))}
                          />
                        }
                        label="Exibir marca d'água"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Opacidade da marca d'água"
                        type="number"
                        inputProps={{ min: 0, max: 100, step: 1 }}
                        value={Math.round(modeloPrescricaoPDF.logoWatermark.opacity * 100)}
                        onChange={(e) => {
                          const value = Math.max(0, Math.min(100, Number(e.target.value))) / 100;
                          setModeloPrescricaoPDF(prev => ({
                            ...prev,
                            logoWatermark: { ...prev.logoWatermark, opacity: value }
                          }));
                        }}
                        fullWidth
                        margin="normal"
                        helperText="0-100%"
                        InputProps={{
                          endAdornment: '%',
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor dos Rótulos"
                        type="color"
                        value={modeloPrescricaoPDF.pacienteInfo.labelColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          pacienteInfo: { ...prev.pacienteInfo, labelColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Tamanho dos Rótulos"
                        type="number"
                        value={modeloPrescricaoPDF.pacienteInfo.labelSize}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          pacienteInfo: { ...prev.pacienteInfo, labelSize: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor do Texto"
                        type="color"
                        value={modeloPrescricaoPDF.pacienteInfo.textColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          pacienteInfo: { ...prev.pacienteInfo, textColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Tamanho do Texto"
                        type="number"
                        value={modeloPrescricaoPDF.pacienteInfo.textSize}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          pacienteInfo: { ...prev.pacienteInfo, textSize: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor da Borda"
                        type="color"
                        value={modeloPrescricaoPDF.pacienteInfo.borderColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          pacienteInfo: { ...prev.pacienteInfo, borderColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Assinatura */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight="bold">Assinatura</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.assinatura.showLinha}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              assinatura: { ...prev.assinatura, showLinha: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Linha"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.assinatura.showNome}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              assinatura: { ...prev.assinatura, showNome: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Nome"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor da Linha"
                        type="color"
                        value={modeloPrescricaoPDF.assinatura.linhaColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          assinatura: { ...prev.assinatura, linhaColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor do Texto"
                        type="color"
                        value={modeloPrescricaoPDF.assinatura.textoColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          assinatura: { ...prev.assinatura, textoColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Tamanho do Texto"
                        type="number"
                        value={modeloPrescricaoPDF.assinatura.textoSize}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          assinatura: { ...prev.assinatura, textoSize: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Rodapé */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight="bold">Rodapé</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor de Fundo do Rodapé"
                        type="color"
                        value={modeloPrescricaoPDF.footer.backgroundColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          footer: { ...prev.footer, backgroundColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.footer.showWaves}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              footer: { ...prev.footer, showWaves: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Faixas Decorativas"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor da Faixa 1"
                        type="color"
                        value={modeloPrescricaoPDF.footer.wave1Color}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          footer: { ...prev.footer, wave1Color: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor da Faixa 2"
                        type="color"
                        value={modeloPrescricaoPDF.footer.wave2Color}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          footer: { ...prev.footer, wave2Color: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.footer.showQRCode}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              footer: { ...prev.footer, showQRCode: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar QR Code"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.footer.showContactInfo}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              footer: { ...prev.footer, showContactInfo: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Contatos"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.footer.showClinicaNome}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              footer: { ...prev.footer, showClinicaNome: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Nome da Clínica"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor das Informações de Contato"
                        type="color"
                        value={modeloPrescricaoPDF.footer.contactInfoColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          footer: { ...prev.footer, contactInfoColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Tamanho das Informações de Contato"
                        type="number"
                        value={modeloPrescricaoPDF.footer.contactInfoSize}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          footer: { ...prev.footer, contactInfoSize: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor do Nome da Clínica"
                        type="color"
                        value={modeloPrescricaoPDF.footer.clinicaNomeColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          footer: { ...prev.footer, clinicaNomeColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Tamanho do Nome da Clínica"
                        type="number"
                        value={modeloPrescricaoPDF.footer.clinicaNomeSize}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          footer: { ...prev.footer, clinicaNomeSize: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Header */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight="bold">Cabeçalho</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.header.showTitle}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              header: { ...prev.header, showTitle: e.target.checked }
                            }))}
                          />
                        }
                        label="Exibir cabeçalho"
                      />
                    </Grid>
                    {modeloPrescricaoPDF.header.showTitle && (
                      <>
                        <Grid item xs={12}>
                          <TextField
                            label="Título do Cabeçalho"
                            value={modeloPrescricaoPDF.header.title}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              header: { ...prev.header, title: e.target.value }
                            }))}
                            fullWidth
                            margin="normal"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Cor de Fundo do Cabeçalho"
                            type="color"
                            value={modeloPrescricaoPDF.header.backgroundColor}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              header: { ...prev.header, backgroundColor: e.target.value }
                            }))}
                            fullWidth
                            margin="normal"
                            InputLabelProps={{
                              shrink: true,
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Cor do Título"
                            type="color"
                            value={modeloPrescricaoPDF.header.titleColor}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              header: { ...prev.header, titleColor: e.target.value }
                            }))}
                            fullWidth
                            margin="normal"
                            InputLabelProps={{
                              shrink: true,
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Tamanho do Título"
                            type="number"
                            value={modeloPrescricaoPDF.header.titleSize}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              header: { ...prev.header, titleSize: Number(e.target.value) }
                            }))}
                            fullWidth
                            margin="normal"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={modeloPrescricaoPDF.header.showLogoInHeader}
                                onChange={(e) => setModeloPrescricaoPDF(prev => ({
                                  ...prev,
                                  header: { ...prev.header, showLogoInHeader: e.target.checked }
                                }))}
                              />
                            }
                            label="Mostrar logo no cabeçalho"
                          />
                        </Grid>
                        {modeloPrescricaoPDF.header.showLogoInHeader && (
                          <>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Largura do Logo (px)"
                                type="number"
                                value={modeloPrescricaoPDF.header.logoHeaderSize.width}
                                onChange={(e) => setModeloPrescricaoPDF(prev => ({
                                  ...prev,
                                  header: {
                                    ...prev.header,
                                    logoHeaderSize: {
                                      ...prev.header.logoHeaderSize,
                                      width: Number(e.target.value),
                                    },
                                  },
                                }))}
                                fullWidth
                                margin="normal"
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Altura do Logo (px)"
                                type="number"
                                value={modeloPrescricaoPDF.header.logoHeaderSize.height}
                                onChange={(e) => setModeloPrescricaoPDF(prev => ({
                                  ...prev,
                                  header: {
                                    ...prev.header,
                                    logoHeaderSize: {
                                      ...prev.header.logoHeaderSize,
                                      height: Number(e.target.value),
                                    },
                                  },
                                }))}
                                fullWidth
                                margin="normal"
                              />
                            </Grid>
                          </>
                        )}
                      </>
                    )}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Informações do Médico */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight="bold">Informações do Médico</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.medicoInfo.showNome}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              medicoInfo: { ...prev.medicoInfo, showNome: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Nome do Médico"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.medicoInfo.showEspecialidade}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              medicoInfo: { ...prev.medicoInfo, showEspecialidade: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Especialidade"
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor do Nome"
                        type="color"
                        value={modeloPrescricaoPDF.medicoInfo.nomeColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          medicoInfo: { ...prev.medicoInfo, nomeColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Tamanho do Nome"
                        type="number"
                        value={modeloPrescricaoPDF.medicoInfo.nomeSize}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          medicoInfo: { ...prev.medicoInfo, nomeSize: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor da Especialidade"
                        type="color"
                        value={modeloPrescricaoPDF.medicoInfo.especialidadeColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          medicoInfo: { ...prev.medicoInfo, especialidadeColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Tamanho da Especialidade"
                        type="number"
                        value={modeloPrescricaoPDF.medicoInfo.especialidadeSize}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          medicoInfo: { ...prev.medicoInfo, especialidadeSize: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor da Tagline"
                        type="color"
                        value={modeloPrescricaoPDF.medicoInfo.taglineColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          medicoInfo: { ...prev.medicoInfo, taglineColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Tamanho da Tagline"
                        type="number"
                        value={modeloPrescricaoPDF.medicoInfo.taglineSize}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          medicoInfo: { ...prev.medicoInfo, taglineSize: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Informações do Paciente */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight="bold">Informações do Paciente</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.pacienteInfo.showNome}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              pacienteInfo: { ...prev.pacienteInfo, showNome: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Nome"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.pacienteInfo.showEndereco}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              pacienteInfo: { ...prev.pacienteInfo, showEndereco: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Endereço"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.pacienteInfo.showSeguro}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              pacienteInfo: { ...prev.pacienteInfo, showSeguro: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Plano de Saúde"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.pacienteInfo.showDiagnostico}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              pacienteInfo: { ...prev.pacienteInfo, showDiagnostico: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Diagnóstico"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={modeloPrescricaoPDF.pacienteInfo.showData}
                            onChange={(e) => setModeloPrescricaoPDF(prev => ({
                              ...prev,
                              pacienteInfo: { ...prev.pacienteInfo, showData: e.target.checked }
                            }))}
                          />
                        }
                        label="Mostrar Data da Receita"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Prescrição */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight="bold">Seção de Prescrição</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        label="Título da Prescrição"
                        value={modeloPrescricaoPDF.prescricao.title}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          prescricao: { ...prev.prescricao, title: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor do Título"
                        type="color"
                        value={modeloPrescricaoPDF.prescricao.titleColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          prescricao: { ...prev.prescricao, titleColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Tamanho do Título"
                        type="number"
                        value={modeloPrescricaoPDF.prescricao.titleSize}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          prescricao: { ...prev.prescricao, titleSize: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Cor dos Itens"
                        type="color"
                        value={modeloPrescricaoPDF.prescricao.itemColor}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          prescricao: { ...prev.prescricao, itemColor: e.target.value }
                        }))}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Tamanho dos Itens"
                        type="number"
                        value={modeloPrescricaoPDF.prescricao.itemSize}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          prescricao: { ...prev.prescricao, itemSize: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Altura da Linha"
                        type="number"
                        inputProps={{ step: 0.1 }}
                        value={modeloPrescricaoPDF.prescricao.lineHeight}
                        onChange={(e) => setModeloPrescricaoPDF(prev => ({
                          ...prev,
                          prescricao: { ...prev.prescricao, lineHeight: Number(e.target.value) }
                        }))}
                        fullWidth
                        margin="normal"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Card sx={{ mt: 2, backgroundColor: '#f5f5f5' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    <strong>Nota:</strong> O modelo será salvo automaticamente quando você clicar em "Salvar". O logo aparecerá como marca d'água centralizada no documento PDF.
                  </Typography>
                </CardContent>
              </Card>
            </Box>
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
