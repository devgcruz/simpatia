import { Request, Response } from 'express';
import authService from '../services/auth.service';
import { invalidateToken, disconnectUserSockets } from '../services/websocket.service';

class AuthController {
    async handleLogin(req: Request, res: Response) {
        try {
            const { email, senha } = req.body;

            // Validar que email e senha foram fornecidos
            if (!email || !senha) {
                return res.status(400).json({ message: "Email e senha são obrigatórios." });
            }

            // Chamar o serviço de autenticação
            const { token, refreshToken, doutor } = await authService.login(email, senha);

            // Proteção (Cookies Seguros): Configurar cookie com opções de segurança
            res.cookie('token', token, {
                httpOnly: true, // Impede acesso via JS (XSS)
                secure: process.env.NODE_ENV === 'production', // Só envia em HTTPS
                // Em desenvolvimento, usamos 'lax' para permitir cookie entre portas (3000/5173 -> 3333)
                sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
                maxAge: 15 * 60 * 1000 // 15 minutos (access token)
            });

            // Cookie para refresh token (válido por 7 dias)
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
            });

            // Retornar status 200 com os dados do doutor (sem a senha)
            return res.status(200).json(doutor);

        } catch (error: any) {
            // Proteção (Mensagem Genérica): Retornar mensagem genérica para credenciais inválidas
            if (error.message === "Credenciais inválidas.") {
                return res.status(401).json({ message: "Credenciais inválidas." });
            }

            // Outros erros
            return res.status(500).json({ message: "Erro interno do servidor." });
        }
    }

    async handleLogout(req: Request, res: Response) {
        try {
            // Obter token do cookie ou header
            const tokenFromCookie = req.cookies?.token;
            const authHeader = req.headers.authorization;
            const token = tokenFromCookie || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

            // Invalidar o token (adicionar à blacklist)
            if (token) {
                invalidateToken(token);
            }

            // Desconectar todos os sockets do usuário
            if (req.user?.id) {
                disconnectUserSockets(req.user.id);
            }

            // Limpar cookie
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            });

            return res.status(200).json({ message: 'Logout bem-sucedido. Sessão invalidada.' });
        } catch (error: any) {
            console.error('Erro no logout:', error);
            // Mesmo com erro, limpar o cookie
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            });
            return res.status(200).json({ message: 'Logout realizado.' });
        }
    }

    async handleRefreshToken(req: Request, res: Response) {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

            if (!refreshToken) {
                return res.status(400).json({ message: 'Refresh token não fornecido' });
            }

            const { token } = await authService.refreshAccessToken(refreshToken);

            // Atualizar cookie do access token
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
                maxAge: 15 * 60 * 1000 // 15 minutos
            });

            return res.json({ token });
        } catch (error: any) {
            return res.status(401).json({ message: error.message || 'Refresh token inválido' });
        }
    }
}

export default new AuthController();

