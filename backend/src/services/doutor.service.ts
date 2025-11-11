import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

interface ICreateDoutor {
    nome: string;
    email: string;
    senha: string;
    especialidade?: string;
    role?: string;
    clinicaId?: number;
}

interface IUpdateDoutor {
    nome?: string;
    email?: string;
    senha?: string;
    especialidade?: string;
    role?: string;
}

class DoutorService {

    private adminSelect = {
        id: true,
        nome: true,
        email: true,
        especialidade: true,
        role: true,
        clinicaId: true,
    };

    private superAdminSelect = {
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

    async getAll(user: { id: number, role: string, clinicaId: number | null }) {
        if (user.role === 'SUPER_ADMIN') {
            return prisma.doutor.findMany({
                select: this.superAdminSelect,
            });
        }

        if (user.role === 'CLINICA_ADMIN') {
            if (!user.clinicaId) {
                throw new Error("CLINICA_ADMIN logado não possui clínica associada.");
            }
            return prisma.doutor.findMany({
                where: {
                    clinicaId: user.clinicaId,
                    role: {
                        not: 'SUPER_ADMIN',
                    },
                },
                select: this.adminSelect,
            });
        }

        return [];
    }

    /**
     * Retorna uma lista simplificada de doutores para a IA.
     * Não requer autenticação, apenas o ID da clínica.
     */
    async getAllParaIA(clinicaId: number) {
        return prisma.doutor.findMany({
            where: { clinicaId: clinicaId },
            select: {
                id: true,
                nome: true,
                especialidade: true,
            }
        });
    }

    async getById(id: number, user: { id: number, role: string, clinicaId: number | null }) {
        if (user.role === 'SUPER_ADMIN') {
            return prisma.doutor.findUnique({
                where: { id },
                select: this.superAdminSelect,
            });
        }

        if (user.role === 'CLINICA_ADMIN') {
            if (!user.clinicaId) {
                throw new Error("CLINICA_ADMIN logado não possui clínica associada.");
            }
            return prisma.doutor.findFirst({
                where: { id, clinicaId: user.clinicaId },
                select: this.adminSelect,
            });
        }

        return null;
    }

    async create(data: ICreateDoutor, user: { id: number, role: string, clinicaId: number | null }) {
        const { nome, email, senha, especialidade, role } = data;

        if (!nome || !email || !senha) {
            throw new Error("Nome, email e senha são obrigatórios.");
        }

        const emailExistente = await prisma.doutor.findUnique({
            where: { email },
        });

        if (emailExistente) {
            throw new Error("Esse email já está cadastrado.");
        }

        let targetClinicaId: number;

        if (user.role === 'SUPER_ADMIN') {
            if (!data.clinicaId) {
                throw new Error("Super Admin deve especificar um clinicaId para o novo doutor.");
            }
            targetClinicaId = data.clinicaId;
        } else if (user.role === 'CLINICA_ADMIN') {
            if (!user.clinicaId) {
                throw new Error("CLINICA_ADMIN logado não possui clínica associada.");
            }
            targetClinicaId = user.clinicaId;
        } else {
            throw new Error("Acesso negado. Permissão insuficiente.");
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
            select: user.role === 'SUPER_ADMIN' ? this.superAdminSelect : this.adminSelect,
        });

        return novoDoutor;
    }

    async update(id: number, data: any, user: { id: number, role: string, clinicaId: number | null }) {
        const selectFields = user.role === 'SUPER_ADMIN' ? this.superAdminSelect : this.adminSelect;

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

