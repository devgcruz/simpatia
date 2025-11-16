import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, Divider, Tabs, Tab, IconButton, InputAdornment, Tooltip
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import { IClinica } from '../../types/models';
import { useAuth } from '../../hooks/useAuth';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { renovarWebhookVerifyToken } from '../../services/clinica.service';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: IClinica | null;
}

const initialStateCriacao = {
  nome: '',
  cnpj: '',
  endereco: '',
  telefone: '',
  adminNome: '',
  adminEmail: '',
  adminSenha: '',
  horarioInicio: '',
  horarioFim: '',
  pausaInicio: '',
  pausaFim: '',
};


export const ClinicaFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initialData }) => {
  const [form, setForm] = useState<any>(initialStateCriacao);
  const [tabValue, setTabValue] = useState(0);
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const { user } = useAuth();
  const isEditing = !!initialData;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (initialData) {
      setForm({
        nome: initialData.nome,
        cnpj: initialData.cnpj || '',
        endereco: initialData.endereco || '',
        telefone: initialData.telefone || '',
        whatsappToken: initialData.whatsappToken || '',
        whatsappPhoneId: initialData.whatsappPhoneId || '',
        webhookUrlId: initialData.webhookUrlId || '',
        webhookVerifyToken: initialData.webhookVerifyToken || '',
        horarioInicio: initialData.horarioInicio || '',
        horarioFim: initialData.horarioFim || '',
        pausaInicio: initialData.pausaInicio || '',
        pausaFim: initialData.pausaFim || '',
      });
    } else {
      setForm(initialStateCriacao);
    }
    // Reset tab quando o modal abre/fecha
    setTabValue(0);
  }, [initialData, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const handleCopyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${fieldName} copiado para a área de transferência!`);
    } catch (error) {
      toast.error('Erro ao copiar para a área de transferência');
    }
  };

  const handleRenovarToken = async () => {
    if (!initialData) return;
    
    try {
      const clinicaAtualizada = await renovarWebhookVerifyToken(initialData.id);
      setForm((prev: any) => ({
        ...prev,
        webhookVerifyToken: clinicaAtualizada.webhookVerifyToken || '',
      }));
      toast.success('Webhook Verify Token renovado com sucesso!');
      setShowRenovarModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao renovar token');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Editar Clínica' : 'Nova Clínica e Admin'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        {isEditing && isSuperAdmin ? (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
                <Tab label="Dados da Clínica" />
                <Tab label="Integração WhatsApp" />
              </Tabs>
            </Box>
            <DialogContent>
              {tabValue === 0 && (
                <>
                  <TextField name="nome" label="Nome da Clínica" value={form.nome} onChange={handleChange} fullWidth required margin="normal" />
                  <TextField name="cnpj" label="CNPJ" value={form.cnpj} onChange={handleChange} fullWidth margin="normal" />
                  <TextField name="endereco" label="Endereço" value={form.endereco} onChange={handleChange} fullWidth margin="normal" />
                  <TextField name="telefone" label="Telefone" value={form.telefone} onChange={handleChange} fullWidth margin="normal" />
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6">Horário de Funcionamento</Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    Defina o horário de funcionamento da clínica. O calendário do dashboard respeitará estes horários.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <TextField
                      name="horarioInicio"
                      label="Horário de Abertura"
                      value={form.horarioInicio}
                      onChange={handleChange}
                      type="time"
                      fullWidth
                      margin="normal"
                      InputLabelProps={{ shrink: true }}
                      helperText="Ex: 08:00"
                    />
                    <TextField
                      name="horarioFim"
                      label="Horário de Fechamento"
                      value={form.horarioFim}
                      onChange={handleChange}
                      type="time"
                      fullWidth
                      margin="normal"
                      InputLabelProps={{ shrink: true }}
                      helperText="Ex: 18:00"
                    />
                  </Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    Intervalo de almoço (opcional)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      name="pausaInicio"
                      label="Início da Pausa"
                      value={form.pausaInicio}
                      onChange={handleChange}
                      type="time"
                      fullWidth
                      margin="normal"
                      InputLabelProps={{ shrink: true }}
                      helperText="Ex: 12:00"
                    />
                    <TextField
                      name="pausaFim"
                      label="Fim da Pausa"
                      value={form.pausaFim}
                      onChange={handleChange}
                      type="time"
                      fullWidth
                      margin="normal"
                      InputLabelProps={{ shrink: true }}
                      helperText="Ex: 13:00"
                    />
                  </Box>
                </>
              )}
              {tabValue === 1 && (
                <>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Configure a integração do WhatsApp para esta clínica. Estes dados são fornecidos pelo painel da Meta/Facebook.
                  </Typography>
                  <TextField
                    name="whatsappToken"
                    label="Token do WhatsApp"
                    value={form.whatsappToken}
                    onChange={handleChange}
                    fullWidth
                    margin="normal"
                    type="password"
                    helperText="Token de acesso do WhatsApp Business API"
                  />
                  <TextField
                    name="whatsappPhoneId"
                    label="Phone ID do WhatsApp"
                    value={form.whatsappPhoneId}
                    onChange={handleChange}
                    fullWidth
                    margin="normal"
                    helperText="ID do número de telefone do WhatsApp Business"
                  />
                  <TextField
                    name="webhookUrlId"
                    label="Webhook URL ID"
                    value={form.webhookUrlId}
                    onChange={handleChange}
                    fullWidth
                    margin="normal"
                    disabled
                    helperText="ID único do webhook (gerado automaticamente pelo sistema)"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title="Copiar">
                            <IconButton
                              onClick={() => handleCopyToClipboard(form.webhookUrlId, 'Webhook URL ID')}
                              edge="end"
                              size="small"
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    name="webhookVerifyToken"
                    label="Webhook Verify Token"
                    value={form.webhookVerifyToken}
                    onChange={handleChange}
                    fullWidth
                    margin="normal"
                    type="password"
                    disabled
                    helperText="Token de verificação do webhook (gerado automaticamente pelo sistema). Use o botão Renovar para gerar um novo token."
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Copiar">
                              <IconButton
                                onClick={() => handleCopyToClipboard(form.webhookVerifyToken, 'Webhook Verify Token')}
                                edge="end"
                                size="small"
                                disabled={!form.webhookVerifyToken}
                              >
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Renovar Token">
                              <IconButton
                                onClick={() => setShowRenovarModal(true)}
                                edge="end"
                                size="small"
                                color="warning"
                              >
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </InputAdornment>
                      ),
                    }}
                  />
                </>
              )}
            </DialogContent>
          </>
        ) : (
          <DialogContent>
            <Typography variant="h6">Dados da Clínica</Typography>
            <TextField name="nome" label="Nome da Clínica" value={form.nome} onChange={handleChange} fullWidth required margin="normal" />
            <TextField name="cnpj" label="CNPJ" value={form.cnpj} onChange={handleChange} fullWidth margin="normal" />
            <TextField name="endereco" label="Endereço" value={form.endereco} onChange={handleChange} fullWidth margin="normal" />
            <TextField name="telefone" label="Telefone" value={form.telefone} onChange={handleChange} fullWidth margin="normal" />

            {isEditing ? (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6">Integração WhatsApp</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                  (Estes dados são fornecidos pelo painel da Meta/Facebook da clínica)
                </Typography>
                <TextField
                  name="whatsappToken"
                  label="Token do WhatsApp"
                  value={form.whatsappToken}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  type="password"
                />
                <TextField
                  name="whatsappPhoneId"
                  label="Phone ID do WhatsApp"
                  value={form.whatsappPhoneId}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                />
              </>
            ) : (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6">Horário de Funcionamento</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                  Defina o horário de funcionamento da clínica. O calendário do dashboard respeitará estes horários.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField
                    name="horarioInicio"
                    label="Horário de Abertura"
                    value={form.horarioInicio}
                    onChange={handleChange}
                    type="time"
                    fullWidth
                    required
                    margin="normal"
                    InputLabelProps={{ shrink: true }}
                    helperText="Ex: 08:00"
                  />
                  <TextField
                    name="horarioFim"
                    label="Horário de Fechamento"
                    value={form.horarioFim}
                    onChange={handleChange}
                    type="time"
                    fullWidth
                    required
                    margin="normal"
                    InputLabelProps={{ shrink: true }}
                    helperText="Ex: 18:00"
                  />
                </Box>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                  Intervalo de almoço (opcional)
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField
                    name="pausaInicio"
                    label="Início da Pausa"
                    value={form.pausaInicio}
                    onChange={handleChange}
                    type="time"
                    fullWidth
                    margin="normal"
                    InputLabelProps={{ shrink: true }}
                    helperText="Ex: 12:00"
                  />
                  <TextField
                    name="pausaFim"
                    label="Fim da Pausa"
                    value={form.pausaFim}
                    onChange={handleChange}
                    type="time"
                    fullWidth
                    margin="normal"
                    InputLabelProps={{ shrink: true }}
                    helperText="Ex: 13:00"
                  />
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6">Dados do Admin da Clínica</Typography>
                <TextField name="adminNome" label="Nome do Admin" value={form.adminNome} onChange={handleChange} fullWidth required margin="normal" />
                <TextField name="adminEmail" label="Email do Admin" type="email" value={form.adminEmail} onChange={handleChange} fullWidth required margin="normal" />
                <TextField name="adminSenha" label="Senha Provisória" type="password" value={form.adminSenha} onChange={handleChange} fullWidth required margin="normal" />
              </>
            )}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained">Salvar</Button>
        </DialogActions>
      </Box>

      <ConfirmationModal
        open={showRenovarModal}
        onClose={() => setShowRenovarModal(false)}
        onConfirm={handleRenovarToken}
        title="Renovar Webhook Verify Token"
        message="Tem certeza que deseja renovar o Webhook Verify Token? O token atual será invalidado e você precisará atualizar a configuração do webhook no painel do WhatsApp/Meta."
        confirmButtonText="Renovar"
        confirmButtonColor="warning"
      />
    </Dialog>
  );
};

