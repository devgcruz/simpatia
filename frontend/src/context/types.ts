// src/context/types.ts

// O objeto de usuário que recebemos da API (do JWT)
export interface IUser {
  id: number;
  nome: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CLINICA_ADMIN' | 'DOUTOR' | 'SECRETARIA';
  clinicaId: number | null;
  fotoPerfil?: string | null;
}

// O que o nosso contexto de autenticação vai fornecer
export interface IAuthContext {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: IUser | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

