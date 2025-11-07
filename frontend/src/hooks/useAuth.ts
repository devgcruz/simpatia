// src/hooks/useAuth.ts
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import { IAuthContext } from '../context/types';

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }

  return context as IAuthContext;
};

