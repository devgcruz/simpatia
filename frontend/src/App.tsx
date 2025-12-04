// src/App.tsx
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
import { SecretariasPage } from './pages/SecretariasPage';
import { ChatInternoPage } from './components/chat-interno/ChatInternoPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { DashboardLayout } from './layouts/DashboardLayout';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Toaster } from 'sonner';

const theme = createTheme();

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
              <Route path="/chat-interno" element={<ChatInternoPage />} />
              <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            </Route>
          </Route>

          {/* Redirecionamento padrão */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

