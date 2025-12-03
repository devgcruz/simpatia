import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { DoutorSelecionadoProvider } from './context/DoutorSelecionadoContext';
import { NotificationProvider } from './context/NotificationContext';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <DoutorSelecionadoProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </DoutorSelecionadoProvider>
    </AuthProvider>
  </React.StrictMode>,
);

