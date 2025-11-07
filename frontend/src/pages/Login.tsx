import React, { useState, useRef } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  LocalHospital as HospitalIcon,
  Psychology as AIIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTechBackground } from '../hooks/useTechBackground';

const Login: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { login } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = theme.palette.mode === 'dark';
  
  useTechBackground(canvasRef, isDark);
  
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, senha);
      navigate('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 
        'Erro ao fazer login. Verifique suas credenciais.'
      );
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: alpha('#E3F2FD', 0.05), // Azul claro com 5% de opacidade
      }}
    >
      <canvas
        ref={canvasRef}
        id="tech-background"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backdropFilter: 'blur(1.5px)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
      <Container 
        maxWidth="sm"
        sx={{
          position: 'relative',
          zIndex: 2,
        }}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <Card
              elevation={0}
              sx={{
                backgroundColor: alpha(theme.palette.background.paper, 0.9),
                border: 'none',
                boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.1)}`,
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.background.paper, 0.9),
                  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.25)}`,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: 5 }}>
                {/* Header */}
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mb: 4,
                  }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 200,
                      damping: 15,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                        mb: 2,
                        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
                      }}
                    >
                      <HospitalIcon sx={{ fontSize: 40, color: 'white' }} />
                    </Box>
                  </motion.div>
                  
                  <motion.div variants={itemVariants}>
                    <Typography
                      variant="h4"
                      component="h1"
                      gutterBottom
                      sx={{
                        fontWeight: 700,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 1,
                      }}
                    >
                      Simpatia
                    </Typography>
                  </motion.div>
                  
                  <motion.div variants={itemVariants}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <AIIcon sx={{ fontSize: 20, color: theme.palette.secondary.main }} />
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontWeight: 500 }}
                      >
                        Sistema de Atendimento Médico com IA
                      </Typography>
                    </Box>
                  </motion.div>
                  
                  <motion.div variants={itemVariants}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ textAlign: 'center', maxWidth: 300 }}
                    >
                      Acesse sua conta para gerenciar seus pacientes e agendamentos
                    </Typography>
                  </motion.div>
                </Box>

                {/* Form */}
                <motion.form variants={itemVariants} onSubmit={handleSubmit}>
                  {error && (
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                      {error}
                    </Alert>
                  )}

                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    margin="normal"
                    required
                    autoComplete="email"
                    autoFocus
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 2 }}
                  />

                  <TextField
                    fullWidth
                    label="Senha"
                    type={showPassword ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    margin="normal"
                    required
                    autoComplete="current-password"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 3 }}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading}
                    sx={{
                      py: 1.5,
                      fontSize: '1rem',
                      fontWeight: 600,
                      mb: 2,
                      position: 'relative',
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </motion.form>

                {/* Footer */}
                <motion.div variants={itemVariants}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    align="center"
                    sx={{ mt: 3 }}
                  >
                    Sistema seguro e protegido
                  </Typography>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </Container>
    </Box>
  );
};

export default Login;

