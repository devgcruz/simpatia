import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

interface ICreateDoutor {
    nome: string;
    email: string;
    senha: string;
    clinicaId: number;
}

interface IUpdateDoutor {
    nome?: string;
    email?: string;
    senha?: string;
    clinicaId?: number;
}

class DoutorService {

    async getAll() {
        const doutores = await prisma.doutor.findMany();
        return doutores;
    }

    async getById(id: number) {
        const doutor = await prisma.doutor.findUnique({
            where: { id },
        });

        if (!doutor) {
            throw new Error("Doutor não encontrado.");
        }

        return doutor;
    }

    async create(data: ICreateDoutor) {
        const { nome, email, senha, clinicaId } = data;

        if (!nome || !email || !senha || !clinicaId) {
            throw new Error("Nome, email, senha e clinicaId são obrigatórios.");
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

        // Nota: clinicaId é validado como obrigatório, mas não está no modelo Doutor atual
        // Será necessário atualizar o schema.prisma para incluir clinicaId antes de usar este campo
        const novoDoutor = await prisma.doutor.create({
            data: {
                nome,
                email,
                senha: senhaHash,
                // TODO: Adicionar clinicaId quando o schema for atualizado
                // clinicaId: clinicaId
            },
        });

        return novoDoutor;
    }

    async update(id: number, data: IUpdateDoutor) {
        const doutorExistente = await prisma.doutor.findUnique({
            where: { id },
        });

        if (!doutorExistente) {
            throw new Error("Doutor não encontrado.");
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
        });

        return doutorAtualizado;
    }

    async delete(id: number) {
        const doutorExistente = await prisma.doutor.findUnique({
            where: { id },
        });

        if (!doutorExistente) {
            throw new Error("Doutor não encontrado.");
        }

        await prisma.doutor.delete({
            where: { id },
        });

        return { message: "Doutor deletado com sucesso." };
    }
}

export default new DoutorService();

