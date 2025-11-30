// src/context/AuthContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import { IAuthContext, IUser } from './types';
import { disconnectWebSocket } from '../hooks/useWebSocket';

const AuthContext = createContext<IAuthContext | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/auth/me');
        const userData: IUser = response.data;
        setUser(userData);
        setIsAuthenticated(true);
      } catch {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, senha: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, senha });
      const userData: IUser = response.data;
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      console.error('Falha no login:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Desconectar WebSocket antes de fazer logout
      disconnectWebSocket();
      
      // Fazer logout no backend
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Erro no logout:', error);
      // Mesmo com erro, desconectar WebSocket e limpar estado
      disconnectWebSocket();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  const value: IAuthContext = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

