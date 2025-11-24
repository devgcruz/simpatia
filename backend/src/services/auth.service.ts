import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

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

        // Sucesso (JWT): Criar token JWT
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET não configurado no ambiente.");
        }

        const token = jwt.sign(
            { 
                sub: doutor.id, 
                email: doutor.email,
                role: doutor.role,
                clinicaId: doutor.clinicaId
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Retornar token e doutor (sem a senha)
        const { senha, ...doutorSemSenha } = doutor;
        return { token, doutor: doutorSemSenha };
    }
}

export default new AuthService();

