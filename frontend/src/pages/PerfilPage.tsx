import React, { useState, useRef } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Avatar,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  PhotoCamera as PhotoCameraIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { toast } from 'sonner';

export const PerfilPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para extrair primeiro e último nome
  const obterNomeExibicao = (nomeCompleto: string) => {
    const nomes = nomeCompleto.trim().split(/\s+/);
    const primeiroNome = nomes[0] || '';
    const ultimoNome = nomes.length > 1 ? nomes[nomes.length - 1] : '';
    return { primeiroNome, ultimoNome, nomeCompleto: `${primeiroNome}${ultimoNome ? ' ' + ultimoNome : ''}` };
  };

  const nomeExibicao = user?.nome ? obterNomeExibicao(user.nome) : { primeiroNome: '', ultimoNome: '', nomeCompleto: '' };

  const handleUploadFoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (máximo 2MB para base64)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setCarregandoFoto(true);
    setErro(null);

    try {
      // Converter para base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          
          // Validar tamanho do base64 (aproximadamente 33% maior que o arquivo original)
          if (base64String.length > 3 * 1024 * 1024) {
            toast.error('A imagem é muito grande. Por favor, escolha uma imagem menor.');
            setCarregandoFoto(false);
            return;
          }
          
          console.log('[PerfilPage] Enviando foto, tamanho base64:', base64String.length);
          
          // Enviar para o backend
          await api.put('/auth/profile', {
            fotoPerfil: base64String,
          });

          toast.success('Foto de perfil atualizada com sucesso!');
          await refreshUser();
        } catch (error: any) {
          console.error('Erro ao atualizar foto:', error);
          toast.error(error.response?.data?.message || 'Erro ao atualizar foto de perfil');
        } finally {
          setCarregandoFoto(false);
        }
      };
      reader.onerror = () => {
        toast.error('Erro ao ler o arquivo');
        setCarregandoFoto(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Erro ao processar foto:', error);
      toast.error('Erro ao processar foto');
      setCarregandoFoto(false);
    }
  };

  const handleRemoverFoto = async () => {
    setCarregandoFoto(true);
    setErro(null);

    try {
      await api.put('/auth/profile', {
        fotoPerfil: null,
      });

      toast.success('Foto de perfil removida com sucesso!');
      await refreshUser();
    } catch (error: any) {
      console.error('Erro ao remover foto:', error);
      toast.error(error.response?.data?.message || 'Erro ao remover foto de perfil');
    } finally {
      setCarregandoFoto(false);
    }
  };

  const handleAlterarSenha = async () => {
    setErro(null);

    // Validações
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      setErro('Por favor, preencha todos os campos');
      return;
    }

    if (novaSenha.length < 6) {
      setErro('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem');
      return;
    }

    setCarregando(true);

    try {
      await api.put('/auth/profile', {
        senhaAtual,
        novaSenha,
      });

      toast.success('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      setErro(error.response?.data?.message || 'Erro ao alterar senha');
    } finally {
      setCarregando(false);
    }
  };

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">Erro ao carregar dados do usuário</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
          Meu Perfil
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Gerencie suas informações pessoais e configurações de conta
        </Typography>
      </Box>

      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar
            src={user.fotoPerfil || undefined}
            sx={{
              width: 120,
              height: 120,
              bgcolor: 'primary.main',
              fontSize: '3rem',
            }}
          >
            {user.fotoPerfil ? null : nomeExibicao.primeiroNome[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              {nomeExibicao.nomeCompleto || user.nome}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {user.email}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<PhotoCameraIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={carregandoFoto}
                size="small"
              >
                {carregandoFoto ? <CircularProgress size={16} /> : 'Alterar Foto'}
              </Button>
              {user.fotoPerfil && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleRemoverFoto}
                  disabled={carregandoFoto}
                  size="small"
                >
                  Remover Foto
                </Button>
              )}
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleUploadFoto}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 500, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon /> Informações Pessoais
          </Typography>
          <TextField
            fullWidth
            label="Nome"
            value={user.nome}
            disabled
            sx={{ mb: 2 }}
            helperText="O nome não pode ser alterado"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            label="Email"
            value={user.email}
            disabled
            helperText="O email não pode ser alterado"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box component="form" onSubmit={(e) => { e.preventDefault(); handleAlterarSenha(); }}>
          <Typography variant="h6" sx={{ fontWeight: 500, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockIcon /> Alterar Senha
          </Typography>
          {erro && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erro}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Senha Atual"
            type={mostrarSenhaAtual ? 'text' : 'password'}
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}
                    edge="end"
                  >
                    {mostrarSenhaAtual ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            label="Nova Senha"
            type={mostrarNovaSenha ? 'text' : 'password'}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            sx={{ mb: 2 }}
            helperText="Mínimo de 6 caracteres"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                    edge="end"
                  >
                    {mostrarNovaSenha ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            label="Confirmar Nova Senha"
            type={mostrarConfirmarSenha ? 'text' : 'password'}
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                    edge="end"
                  >
                    {mostrarConfirmarSenha ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={carregando || !senhaAtual || !novaSenha || !confirmarSenha}
            sx={{ mt: 1 }}
          >
            {carregando ? <CircularProgress size={24} /> : 'Alterar Senha'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

