import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt.util';

class AuthService {
    async login(email: string, senhaRecebida: string) {
        // Buscar o doutor pelo email (apenas ativos)
        const doutor = await prisma.doutor.findFirst({
            where: { email, ativo: true }
        });

        // Hash dummy para manter tempo de resposta consistente (proteção contra timing attack)
        // Este hash sempre falhará na comparação, mas leva o mesmo tempo que um hash real
        const dummyHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

        // Proteção (Timing/Hashing): Sempre fazer compare, mesmo se o doutor não existir
        // Isso previne enumeração de emails através de timing attacks
        const senhaHash = doutor ? doutor.senha : dummyHash;
        const senhaValida = await bcrypt.compare(senhaRecebida, senhaHash);

        // Proteção (Enumeração): Se o doutor não existir OU a senha estiver errada,
        // disparar erro genérico para não revelar se o email existe
        if (!doutor || !senhaValida) {
            throw new Error("Credenciais inválidas.");
        }

        // Sucesso (JWT): Criar tokens JWT com RS256
        const tokenPayload = {
            sub: doutor.id,
            email: doutor.email,
            role: doutor.role,
            clinicaId: doutor.clinicaId,
        };

        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        // Armazenar refresh token no banco (opcional, para revogação)
        // Por enquanto, vamos retornar ambos os tokens

        // Retornar tokens e doutor (sem a senha)
        const { senha, ...doutorSemSenha } = doutor;
        return { 
            token: accessToken, 
            refreshToken,
            doutor: doutorSemSenha 
        };
    }

    /**
     * Renova o access token usando o refresh token
     */
    async refreshAccessToken(refreshToken: string) {
        try {
            const payload = verifyToken(refreshToken);
            
            if (payload.type !== 'refresh') {
                throw new Error('Token inválido: não é um refresh token');
            }

            // Buscar o usuário para garantir que ainda está ativo
            const doutor = await prisma.doutor.findUnique({
                where: { id: payload.sub },
            });

            if (!doutor || !doutor.ativo) {
                throw new Error('Usuário não encontrado ou inativo');
            }

            // Gerar novo access token
            const newAccessToken = generateAccessToken({
                sub: doutor.id,
                email: doutor.email,
                role: doutor.role,
                clinicaId: doutor.clinicaId,
            });

            return { token: newAccessToken };
        } catch (error: any) {
            throw new Error('Refresh token inválido ou expirado');
        }
    }
}

export default new AuthService();

