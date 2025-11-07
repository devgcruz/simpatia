import axios from 'axios';

// 1. Define a URL base da sua API (do seu backend Express)
const API_URL = 'http://localhost:3333/api'; // (Mude a porta se for diferente)

// 2. Cria uma instância do Axios
export const api = axios.create({
  baseURL: API_URL,

  // 3. A LINHA MAIS IMPORTANTE:
  // Isso diz ao Axios para ENVIAR e RECEBER cookies (como o 'token')
  // em todas as requisições. Sem isso, o login não funciona.
  withCredentials: true, 
});

// 4. (Opcional, mas recomendado) Adiciona um "Interceptor"
// Isso serve para pegar erros de 'Acesso Negado' (401)
api.interceptors.response.use(
  (response) => response, // Se a resposta for OK (2xx), apenas retorne
  (error) => {
    if (error.response?.status === 401) {
      // Se o backend disser "Não autorizado" (token expirou ou não existe)
      // No futuro, vamos redirecionar para o login.
      console.error('API Error (401): Não autorizado.');
      // (Não redirecione ainda, pois o router não existe)
    }
    return Promise.reject(error);
  },
);

