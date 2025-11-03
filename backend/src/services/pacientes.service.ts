import { prisma } from '../lib/prisma';

interface ICreatePaciente {
    nome: string;
    telefone: string;
}

interface IUpdatePaciente {
    nome?: string;
    telefone?: string;
}
class PacienteService {

    async getAll() {
        const paciente = await prisma.paciente.findMany();
        return paciente;
    }

    async getById(id: number) {
        const paciente = await prisma.paciente.findUnique({
            where: { id },
        });

        if (!paciente) {
            throw new Error("Paciente não encontrado.");
        }

        return paciente;

    }

    async create(data: ICreatePaciente) {
        const { nome, telefone } = data;

        if (!nome || !telefone) {
            throw new Error("Nome, Telefone são obrigatórios.");
        }

        const telefoneExistente = await prisma.paciente.findUnique({
            where: { telefone },
        });

        if(telefoneExistente){
            throw new Error("Esse telefone já esta cadastrado.");
        }

        const novoPaciente = await prisma.paciente.create({
            data: {
                nome,
                telefone,
            },
        });

        return novoPaciente;


    }

    async update(id: number, data: IUpdatePaciente){
        const pacienteExistente = await prisma.paciente.findUnique({
            where: { id },
        });

        if (!pacienteExistente){
            throw new Error("Paciente não encontrado.");
        }

        const pacienteAtualizado = await prisma.paciente.update({
            where: { id },
            data: data,
        });

        return pacienteAtualizado;

    }

    async delete(id: number) {

        const pacienteExistente = await prisma.paciente.findUnique({
            where: {id},
        });

        if (!pacienteExistente) {
            throw new Error("Paciente não encontrado.");
        }

        await prisma.paciente.delete({
            where: { id },
        });

        return { message: "Serviço deletado com sucesso."};
    }


}

export default new PacienteService();