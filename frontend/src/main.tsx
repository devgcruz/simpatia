import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { DoutorSelecionadoProvider } from './context/DoutorSelecionadoContext';
import { NotificationProvider } from './context/NotificationContext';
import { SettingsProvider } from './context/SettingsContext';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './index.css';

// Configuração do React Query com staleTime de 5 minutos
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DoutorSelecionadoProvider>
          <SettingsProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </SettingsProvider>
        </DoutorSelecionadoProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

