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

    /**
     * Busca dados completos do usuário
     */
    async getUserData(userId: number) {
        console.log('[Auth Service] getUserData chamado com userId:', userId);
        
        const doutor = await prisma.doutor.findUnique({
            where: { id: userId },
            select: {
                id: true,
                nome: true,
                email: true,
                role: true,
                clinicaId: true,
                fotoPerfil: true,
                ativo: true, // Incluir campo ativo para verificação
            } as any, // TypeScript pode não reconhecer o campo ainda
        });

        console.log('[Auth Service] getUserData - Doutor encontrado:', doutor ? `ID ${doutor.id}, ativo: ${doutor.ativo}` : 'null');

        if (!doutor) {
            console.error('[Auth Service] getUserData - Doutor não encontrado para userId:', userId);
            throw new Error('Usuário não encontrado ou inativo');
        }

        if (!doutor.ativo) {
            console.error('[Auth Service] getUserData - Doutor inativo para userId:', userId);
            throw new Error('Usuário não encontrado ou inativo');
        }

        return doutor;
    }

    /**
     * Atualiza perfil do usuário (senha e/ou foto)
     */
    async updateProfile(userId: number, data: { senhaAtual?: string; novaSenha?: string; fotoPerfil?: string | null }) {
        try {
            console.log('[Auth Service] updateProfile chamado com userId:', userId, 'tipo:', typeof userId);
            
            // Validar que userId é um número válido
            if (!userId || isNaN(userId) || userId <= 0) {
                console.error('[Auth Service] userId inválido:', userId);
                throw new Error('Usuário não encontrado ou inativo');
            }
            
            const doutor = await prisma.doutor.findUnique({
                where: { id: userId },
            });

            console.log('[Auth Service] Doutor encontrado:', doutor ? `ID ${doutor.id}, ativo: ${doutor.ativo}` : 'null');

            if (!doutor) {
                console.error('[Auth Service] Doutor não encontrado para userId:', userId);
                throw new Error('Usuário não encontrado ou inativo');
            }

            if (!doutor.ativo) {
                console.error('[Auth Service] Doutor inativo para userId:', userId);
                throw new Error('Usuário não encontrado ou inativo');
            }

            // Se está tentando alterar senha, verificar senha atual
            if (data.novaSenha) {
                if (!data.senhaAtual) {
                    throw new Error('Senha atual é obrigatória para alterar a senha');
                }

                const senhaValida = await bcrypt.compare(data.senhaAtual, doutor.senha);
                if (!senhaValida) {
                    throw new Error('Senha atual incorreta');
                }

                // Hash da nova senha
                const novaSenhaHash = await bcrypt.hash(data.novaSenha, 10);
                
                const updateData: any = {
                    senha: novaSenhaHash,
                };
                
                // Se também está atualizando foto, incluir no update
                if (data.fotoPerfil !== undefined) {
                    updateData.fotoPerfil = data.fotoPerfil;
                }
                
                await prisma.doutor.update({
                    where: { id: userId },
                    data: updateData,
                });
            } else if (data.fotoPerfil !== undefined) {
                // Apenas atualizar foto
                console.log('[Auth Service] Atualizando apenas foto para userId:', userId, 'tamanho:', data.fotoPerfil?.length || 0);
                
                // Validar tamanho do base64 (máximo 5MB em base64 = ~3.75MB em bytes)
                if (data.fotoPerfil && data.fotoPerfil.length > 5 * 1024 * 1024) {
                    throw new Error('A imagem é muito grande. Tamanho máximo: 2MB');
                }
                
                try {
                    await prisma.doutor.update({
                        where: { id: userId },
                        data: {
                            fotoPerfil: data.fotoPerfil,
                        } as any, // TypeScript pode não reconhecer o campo ainda
                    });
                    console.log('[Auth Service] Foto atualizada com sucesso');
                } catch (prismaError: any) {
                    console.error('[Auth Service] Erro do Prisma:', prismaError);
                    throw new Error(`Erro ao atualizar foto: ${prismaError.message}`);
                }
            }
        } catch (error: any) {
            console.error('[Auth Service] Erro ao atualizar perfil:', error);
            throw error;
        }
    }
}

export default new AuthService();

