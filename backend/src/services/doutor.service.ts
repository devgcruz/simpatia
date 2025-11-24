import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

interface ICreateDoutor {
    nome: string;
    email: string;
    senha: string;
    especialidade?: string;
    crm?: string;
    crmUf?: string;
    rqe?: string;
    role?: string;
    clinicaId?: number;
    pausaInicio?: string;
    pausaFim?: string;
    diasBloqueados?: number[];
    modeloPrescricao?: string;
}

interface IUpdateDoutor {
    nome?: string;
    email?: string;
    senha?: string;
    especialidade?: string;
    crm?: string;
    crmUf?: string;
    rqe?: string;
    role?: string;
    pausaInicio?: string;
    pausaFim?: string;
    diasBloqueados?: number[];
    modeloPrescricao?: string;
}

class DoutorService {

    private adminSelect = {
        id: true,
        nome: true,
        email: true,
        especialidade: true,
        crm: true,
        crmUf: true,
        rqe: true,
        role: true,
        clinicaId: true,
        pausaInicio: true,
        pausaFim: true,
        diasBloqueados: true,
        modeloPrescricao: true,
        clinica: {
            select: {
                nome: true,
                cnpj: true,
                endereco: true,
                telefone: true,
                email: true,
                site: true,
            },
        },
    };

    private superAdminSelect = {
        id: true,
        nome: true,
        email: true,
        especialidade: true,
        crm: true,
        crmUf: true,
        rqe: true,
        role: true,
        clinicaId: true,
        pausaInicio: true,
        pausaFim: true,
        diasBloqueados: true,
        modeloPrescricao: true,
        clinica: {
            select: {
                nome: true,
                cnpj: true,
                endereco: true,
                telefone: true,
                email: true,
                site: true,
            },
        },
    };

    async getAll(user: { id: number, role: string, clinicaId: number | null }) {
        if (user.role === 'SUPER_ADMIN') {
            return prisma.doutor.findMany({
                where: { ativo: true },
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
                    ativo: true,
                },
                select: this.adminSelect,
            });
        }

        if (user.role === 'DOUTOR') {
            // Quando o role é DOUTOR, retornar apenas o doutor logado
            const doutor = await prisma.doutor.findFirst({
                where: { id: user.id, ativo: true },
                select: this.adminSelect,
            });
            return doutor ? [doutor] : [];
        }

        return [];
    }

    /**
     * Retorna uma lista simplificada de doutores para a IA.
     * Não requer autenticação, apenas o ID da clínica.
     */
    async getAllParaIA(clinicaId: number) {
        return prisma.doutor.findMany({
            where: { clinicaId: clinicaId, ativo: true },
            select: {
                id: true,
                nome: true,
                especialidade: true,
            }
        });
    }

    async getById(id: number, user: { id: number, role: string, clinicaId: number | null }) {
        if (user.role === 'SUPER_ADMIN') {
            return prisma.doutor.findFirst({
                where: { id, ativo: true },
                select: this.superAdminSelect,
            });
        }

        if (user.role === 'CLINICA_ADMIN') {
            if (!user.clinicaId) {
                throw new Error("CLINICA_ADMIN logado não possui clínica associada.");
            }
            return prisma.doutor.findFirst({
                where: { id, clinicaId: user.clinicaId, ativo: true },
                select: this.adminSelect,
            });
        }

        return null;
    }

    async create(data: ICreateDoutor, user: { id: number, role: string, clinicaId: number | null }) {
        const { nome, email, senha, especialidade, role, pausaInicio, pausaFim, diasBloqueados } = data;

        if (!nome || !email || !senha) {
            throw new Error("Nome, email e senha são obrigatórios.");
        }

        const emailExistente = await prisma.doutor.findFirst({
            where: { email, ativo: true },
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
                ...(pausaInicio && { pausaInicio }),
                ...(pausaFim && { pausaFim }),
                ...(diasBloqueados && diasBloqueados.length > 0 ? { diasBloqueados } : { diasBloqueados: [] }),
            },
            select: user.role === 'SUPER_ADMIN' ? this.superAdminSelect : this.adminSelect,
        });

        return novoDoutor;
    }

    async update(id: number, data: any, user: { id: number, role: string, clinicaId: number | null }) {
        const selectFields = user.role === 'SUPER_ADMIN' ? this.superAdminSelect : this.adminSelect;

        let doutorExistente = null;

        if (user.role === 'SUPER_ADMIN') {
            doutorExistente = await prisma.doutor.findFirst({ where: { id, ativo: true } });
            if (!doutorExistente) {
                throw new Error("Doutor não encontrado.");
            }
        } else if (user.role === 'CLINICA_ADMIN') {
            if (!user.clinicaId) {
                throw new Error("CLINICA_ADMIN logado não possui clínica associada.");
            }
            doutorExistente = await prisma.doutor.findFirst({
                where: { id, clinicaId: user.clinicaId, ativo: true },
            });

            if (!doutorExistente) {
                throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
            }

            if (data.email && data.email !== doutorExistente.email) {
                const emailExistente = await prisma.doutor.findFirst({
                    where: { email: data.email, ativo: true },
                });

                if (emailExistente) {
                    throw new Error("Esse email já está cadastrado.");
                }
            }
        } else {
            throw new Error("Acesso negado.");
        }

        if (data.email && (!doutorExistente || data.email !== doutorExistente.email)) {
            const emailExistente = await prisma.doutor.findFirst({
                where: { email: data.email, ativo: true },
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
                where: { id, clinicaId: user.clinicaId, ativo: true },
            });

            if (!doutorExistente) {
                throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
            }
        } else {
            throw new Error("Acesso negado.");
        }

        try {
            await prisma.doutor.update({
                where: { id },
                data: { ativo: false },
            });
        } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new Error("Doutor não encontrado.");
            }
            throw error;
        }

        return { message: "Doutor inativado com sucesso." };
    }
}

export default new DoutorService();

