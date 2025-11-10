// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { PublicRoute } from './components/common/PublicRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ServicosPage } from './pages/ServicosPage';
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
              <Route path="/servicos" element={<ServicosPage />} />
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

