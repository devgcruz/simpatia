import { Request, Response } from 'express';
import authService from '../services/auth.service';

class AuthController {
    async handleLogin(req: Request, res: Response) {
        try {
            const { email, senha } = req.body;

            // Validar que email e senha foram fornecidos
            if (!email || !senha) {
                return res.status(400).json({ message: "Email e senha são obrigatórios." });
            }

            // Chamar o serviço de autenticação
            const { token, doutor } = await authService.login(email, senha);

            // Proteção (Cookies Seguros): Configurar cookie com opções de segurança
            res.cookie('token', token, {
                httpOnly: true, // Impede acesso via JS (XSS)
                secure: process.env.NODE_ENV === 'production', // Só envia em HTTPS
                sameSite: 'strict', // Protege contra CSRF
                maxAge: 3600000 // 1 hora, igual ao token
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
        res.clearCookie('token').status(200).json({ message: 'Logout bem-sucedido.' });
    }
}

export default new AuthController();

