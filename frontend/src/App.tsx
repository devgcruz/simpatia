// src/App.tsx

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { PublicRoute } from './components/common/PublicRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ServicosPage } from './pages/ServicosPage';
import { PacientesPage } from './pages/PacientesPage';
import { DoutoresPage } from './pages/DoutoresPage';
import { ClinicasPage } from './pages/ClinicasPage';
import { ChatPage } from './pages/ChatPage';
import { AtendimentoDoDiaPage } from './pages/AtendimentoDoDiaPage';
import { MedicamentosPage } from './pages/MedicamentosPage';
import { PrescricoesPage } from './pages/PrescricoesPage';
import { AtestadosPage } from './pages/AtestadosPage';
import { SecretariasPage } from './pages/SecretariasPage';
import { ChatInternoPage } from './components/chat-interno/ChatInternoPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { PerfilPage } from './pages/PerfilPage';
import { DashboardLayout } from './layouts/DashboardLayout';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Toaster } from 'sonner';
import { useAuth } from './hooks/useAuth';

const theme = createTheme();

// Componente para redirecionamento inteligente baseado na role
const SmartRedirect: React.FC = () => {
  const { user } = useAuth();
  
  // Para todas as roles, redirecionar para dashboard
  // CLINICA_ADMIN agora tem acesso ao dashboard (com visão administrativa)
  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Toaster position="top-center" duration={1000} richColors />
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Rotas públicas */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Rotas privadas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/atendimento" element={<ChatPage />} />
              <Route path="/atendimento-do-dia" element={<AtendimentoDoDiaPage />} />
              <Route path="/servicos" element={<ServicosPage />} />
              <Route path="/pacientes" element={<PacientesPage />} />
              <Route path="/doutores" element={<DoutoresPage />} />
              <Route path="/secretarias" element={<SecretariasPage />} />
              <Route path="/clinicas" element={<ClinicasPage />} />
              <Route path="/medicamentos" element={<MedicamentosPage />} />
              <Route path="/prescricoes" element={<PrescricoesPage />} />
              <Route path="/atestados" element={<AtestadosPage />} />
              <Route path="/chat-interno" element={<ChatInternoPage />} />
              <Route path="/configuracoes" element={<ConfiguracoesPage />} />
              <Route path="/perfil" element={<PerfilPage />} />
            </Route>
          </Route>

          {/* Redirecionamento padrão - baseado na role do usuário */}
          <Route path="*" element={<SmartRedirect />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

