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

    async getAll(clinicaId: number) {
        const doutores = await prisma.doutor.findMany({
            where: { clinicaId },
            select: {
                id: true,
                nome: true,
                email: true,
                especialidade: true,
                role: true,
            },
        });
        return doutores;
    }

    async getById(id: number, clinicaId: number) {
        const doutor = await prisma.doutor.findFirst({
            where: { id, clinicaId },
            select: {
                id: true,
                nome: true,
                email: true,
                especialidade: true,
                role: true,
            },
        });

        if (!doutor) {
            throw new Error("Doutor não encontrado.");
        }

        return doutor;
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

    async update(id: number, data: IUpdateDoutor, clinicaId: number) {
        const doutorExistente = await prisma.doutor.findFirst({
            where: { id, clinicaId },
        });

        if (!doutorExistente) {
            throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
        }

        // Se um novo email foi fornecido, verificar se já existe
        if (data.email && data.email !== doutorExistente.email) {
            const emailExistente = await prisma.doutor.findUnique({
                where: { email: data.email },
            });

            if (emailExistente) {
                throw new Error("Esse email já está cadastrado.");
            }
        }

        // Se uma nova senha foi fornecida, fazer hash
        const updateData: any = { ...data };
        if (data.senha) {
            updateData.senha = await bcrypt.hash(data.senha, 10);
        }

        // Remover senha do objeto se não foi fornecida
        if (!data.senha) {
            delete updateData.senha;
        }

        const doutorAtualizado = await prisma.doutor.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                nome: true,
                email: true,
                especialidade: true,
                role: true,
            },
        });

        return doutorAtualizado;
    }

    async delete(id: number, clinicaId: number) {
        const doutorExistente = await prisma.doutor.findFirst({
            where: { id, clinicaId },
        });

        if (!doutorExistente) {
            throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
        }

        await prisma.doutor.delete({
            where: { id },
        });

        return { message: "Doutor deletado com sucesso." };
    }
}

export default new DoutorService();

