import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

interface ICreateDoutor {
    nome: string;
    email: string;
    senha: string;
    especialidade?: string;
    role?: string;
}

interface IUpdateDoutor {
    nome?: string;
    email?: string;
    senha?: string;
    especialidade?: string;
    role?: string;
}

class DoutorService {

    async getAll(user: { id: number, role: string, clinicaId: number }) {
        const adminSelect = {
            id: true,
            nome: true,
            email: true,
            especialidade: true,
            role: true,
            clinicaId: true,
        };

        const superAdminSelect = {
            id: true,
            nome: true,
            email: true,
            especialidade: true,
            role: true,
            clinicaId: true,
            clinica: {
                select: {
                    nome: true,
                },
            },
        };

        if (user.role === 'SUPER_ADMIN') {
            return prisma.doutor.findMany({
                select: superAdminSelect,
            });
        }

        if (user.role === 'CLINICA_ADMIN') {
            return prisma.doutor.findMany({
                where: { clinicaId: user.clinicaId },
                select: adminSelect,
            });
        }

        return [];
    }

    async getById(id: number, user: { id: number, role: string, clinicaId: number }) {
        const selectComClinica = {
            id: true,
            nome: true,
            email: true,
            especialidade: true,
            role: true,
            clinicaId: true,
            clinica: {
                select: { nome: true },
            },
        };

        const selectSimples = {
            id: true,
            nome: true,
            email: true,
            especialidade: true,
            role: true,
            clinicaId: true,
        };

        if (user.role === 'SUPER_ADMIN') {
            return prisma.doutor.findUnique({
                where: { id },
                select: selectComClinica,
            });
        }

        if (user.role === 'CLINICA_ADMIN') {
            return prisma.doutor.findFirst({
                where: { id, clinicaId: user.clinicaId },
                select: selectSimples,
            });
        }

        return null;
    }

    async create(data: ICreateDoutor, clinicaId: number) {
        const { nome, email, senha, especialidade, role } = data;

        if (!nome || !email || !senha) {
            throw new Error("Nome, email e senha são obrigatórios.");
        }

        // Verificar se o email já existe
        const emailExistente = await prisma.doutor.findUnique({
            where: { email },
        });

        if (emailExistente) {
            throw new Error("Esse email já está cadastrado.");
        }

        // Fazer hash da senha
        const senhaHash = await bcrypt.hash(senha, 10);

        const novoDoutor = await prisma.doutor.create({
            data: {
                nome,
                email,
                senha: senhaHash,
                especialidade,
                role: role as any,
                clinicaId,
            },
            select: {
                id: true,
                nome: true,
                email: true,
                especialidade: true,
                role: true,
            },
        });

        return novoDoutor;
    }

    async update(id: number, data: any, user: { id: number, role: string, clinicaId: number }) {
        const selectFields = {
            id: true,
            nome: true,
            email: true,
            especialidade: true,
            role: true,
        };

        if (user.role === 'SUPER_ADMIN') {
            await prisma.doutor.findUniqueOrThrow({ where: { id } });
        } else if (user.role === 'CLINICA_ADMIN') {
            const doutorExistente = await prisma.doutor.findFirst({
                where: { id, clinicaId: user.clinicaId },
            });

            if (!doutorExistente) {
                throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
            }

            if (data.email && data.email !== doutorExistente.email) {
                const emailExistente = await prisma.doutor.findUnique({
                    where: { email: data.email },
                });

                if (emailExistente) {
                    throw new Error("Esse email já está cadastrado.");
                }
            }
        } else {
            throw new Error("Acesso negado.");
        }

        if (data.email) {
            const emailExistente = await prisma.doutor.findUnique({
                where: { email: data.email },
            });
            if (emailExistente && emailExistente.id !== id) {
                throw new Error("Esse email já está cadastrado.");
            }
        }

        if (data.senha) {
            const salt = await bcrypt.genSalt(10);
            data.senha = await bcrypt.hash(data.senha, salt);
        } else {
            delete data.senha;
        }

        return prisma.doutor.update({
            where: { id },
            data,
            select: selectFields,
        });
    }

    async delete(id: number, user: { id: number, role: string, clinicaId: number }) {
        if (user.role === 'SUPER_ADMIN') {
            await prisma.doutor.findUniqueOrThrow({ where: { id } });
        } else if (user.role === 'CLINICA_ADMIN') {
            const doutorExistente = await prisma.doutor.findFirst({
                where: { id, clinicaId: user.clinicaId },
            });

            if (!doutorExistente) {
                throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
            }
        } else {
            throw new Error("Acesso negado.");
        }

        await prisma.doutor.delete({
            where: { id },
        });

        return prisma.doutor.delete({
            where: { id },
        });
    }
}

export default new DoutorService();

