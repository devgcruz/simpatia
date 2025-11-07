import api from './api';

export interface LoginCredentials {
  email: string;
  senha: string;
}

export interface Doutor {
  id: number;
  nome: string;
  email: string;
  crm?: string;
  especialidade?: string;
  telefone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  doutor: Doutor;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<Doutor> {
    const response = await api.post<Doutor>('/auth/login', credentials);
    return response.data;
  }

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  }
}

export default new AuthService();

