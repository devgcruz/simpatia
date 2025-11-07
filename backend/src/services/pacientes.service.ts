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

    async getAll(clinicaId: number) {
        const paciente = await prisma.paciente.findMany({
            where: { clinicaId },
        });
        return paciente;
    }

    async getById(id: number, clinicaId: number) {
        const paciente = await prisma.paciente.findFirst({
            where: { id, clinicaId },
        });

        if (!paciente) {
            throw new Error("Paciente não encontrado.");
        }

        return paciente;

    }

    async getByTelefone(telefone: string, clinicaId: number) {
        const paciente = await prisma.paciente.findFirst({
            where: { telefone, clinicaId },
        });

        return paciente; // Retorna null se não encontrar, em vez de lançar erro
    }

    async create(data: ICreatePaciente, clinicaId: number) {
        const { nome, telefone } = data;

        if (!nome || !telefone) {
            throw new Error("Nome, Telefone são obrigatórios.");
        }

        const telefoneExistente = await prisma.paciente.findFirst({
            where: { telefone, clinicaId },
        });

        if(telefoneExistente){
            throw new Error("Esse telefone já esta cadastrado.");
        }

        const novoPaciente = await prisma.paciente.create({
            data: {
                nome,
                telefone,
                clinicaId,
            },
        });

        return novoPaciente;


    }

    async update(id: number, data: IUpdatePaciente, clinicaId: number){
        const pacienteExistente = await prisma.paciente.findFirst({
            where: { id, clinicaId },
        });

        if (!pacienteExistente){
            throw new Error("Paciente não encontrado ou não pertence à esta clínica.");
        }

        const pacienteAtualizado = await prisma.paciente.update({
            where: { id },
            data: data,
        });

        return pacienteAtualizado;

    }

    async delete(id: number, clinicaId: number) {

        const pacienteExistente = await prisma.paciente.findFirst({
            where: { id, clinicaId },
        });

        if (!pacienteExistente) {
            throw new Error("Paciente não encontrado ou não pertence à esta clínica.");
        }

        await prisma.paciente.delete({
            where: { id },
        });

        return { message: "Serviço deletado com sucesso."};
    }


}

export default new PacienteService();