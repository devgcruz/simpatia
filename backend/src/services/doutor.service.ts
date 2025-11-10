import { Prisma } from '@prisma/client';
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

    async getAll(user: { id: number, role: string, clinicaId: number | null }) {
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
            if (!user.clinicaId) {
                throw new Error("CLINICA_ADMIN logado não possui clínica associada.");
            }
            return prisma.doutor.findMany({
                where: { clinicaId: user.clinicaId },
                select: adminSelect,
            });
        }

        return [];
    }

    async getById(id: number, user: { id: number, role: string, clinicaId: number | null }) {
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
            if (!user.clinicaId) {
                throw new Error("CLINICA_ADMIN logado não possui clínica associada.");
            }
            return prisma.doutor.findFirst({
                where: { id, clinicaId: user.clinicaId },
                select: selectSimples,
            });
        }

        return null;
    }

    async create(data: ICreateDoutor, user: { id: number, role: string, clinicaId: number | null }) {
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

        let targetClinicaId: number | null = null;
        if (user.role === 'CLINICA_ADMIN') {
            if (!user.clinicaId) {
                throw new Error("CLINICA_ADMIN logado não possui clínica associada.");
            }
            targetClinicaId = user.clinicaId;
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const novoDoutor = await prisma.doutor.create({
            data: {
                nome,
                email,
                senha: senhaHash,
                especialidade: especialidade ?? null,
                role: role as any,
                clinicaId: targetClinicaId,
            },
            select: {
                id: true,
                nome: true,
                email: true,
                especialidade: true,
                role: true,
                clinicaId: true,
            },
        });

        return novoDoutor;
    }

    async update(id: number, data: any, user: { id: number, role: string, clinicaId: number | null }) {
        const selectFields = {
            id: true,
            nome: true,
            email: true,
            especialidade: true,
            role: true,
        };

        let doutorExistente = null;

        if (user.role === 'SUPER_ADMIN') {
            doutorExistente = await prisma.doutor.findUnique({ where: { id } });
            if (!doutorExistente) {
                throw new Error("Doutor não encontrado.");
            }
        } else if (user.role === 'CLINICA_ADMIN') {
            if (!user.clinicaId) {
                throw new Error("CLINICA_ADMIN logado não possui clínica associada.");
            }
            doutorExistente = await prisma.doutor.findFirst({
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

        if (data.email && (!doutorExistente || data.email !== doutorExistente.email)) {
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

    async delete(id: number, user: { id: number, role: string, clinicaId: number | null }) {
        if (user.role === 'SUPER_ADMIN') {
            const doutorExistente = await prisma.doutor.findUnique({ where: { id } });
            if (!doutorExistente) {
                throw new Error("Doutor não encontrado.");
            }
        } else if (user.role === 'CLINICA_ADMIN') {
            if (!user.clinicaId) {
                throw new Error("CLINICA_ADMIN logado não possui clínica associada.");
            }
            const doutorExistente = await prisma.doutor.findFirst({
                where: { id, clinicaId: user.clinicaId },
            });

            if (!doutorExistente) {
                throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
            }
        } else {
            throw new Error("Acesso negado.");
        }

        try {
            await prisma.doutor.delete({
                where: { id },
            });
        } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new Error("Doutor não encontrado.");
            }
            throw error;
        }

        return { message: "Doutor deletado com sucesso." };
    }
}

export default new DoutorService();

