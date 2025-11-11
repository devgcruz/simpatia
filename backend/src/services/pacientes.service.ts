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

    async getHistoricos(id: number, clinicaId: number) {
        const paciente = await prisma.paciente.findFirst({
            where: { id, clinicaId },
        });

        if (!paciente) {
            throw new Error("Paciente não encontrado ou não pertence à esta clínica.");
        }

        const historicos = await (prisma as any).historicoPaciente.findMany({
            where: { pacienteId: id },
            include: {
                agendamento: {
                    include: {
                        servico: true,
                        doutor: {
                            select: {
                                id: true,
                                nome: true,
                                email: true,
                            },
                        },
                    },
                },
            },
            orderBy: [
                { realizadoEm: 'desc' },
                { createdAt: 'desc' },
                { id: 'desc' },
            ],
        });

        return historicos.map((historico: any) => {
            const { agendamento, ...rest } = historico;
            return {
                id: rest.id,
                descricao: rest.descricao,
                realizadoEm: rest.realizadoEm,
                criadoEm: rest.createdAt,
                agendamentoId: rest.agendamentoId,
                servico: agendamento
                ? {
                    id: agendamento.servico.id,
                    nome: agendamento.servico.nome,
                    duracaoMin: agendamento.servico.duracaoMin,
                }
                : null,
                doutor: agendamento
                ? {
                    id: agendamento.doutor.id,
                    nome: agendamento.doutor.nome,
                    email: agendamento.doutor.email,
                }
                : null,
            };
        });
    }

    async getByTelefone(telefone: string, clinicaId: number) {
        const paciente = await prisma.paciente.findFirst({
            where: { telefone, clinicaId },
        });

        return paciente; // Retorna null se não encontrar, em vez de lançar erro
    }

    async getOrCreateByTelefone(telefone: string, clinicaId: number) {
        const pacienteExistente = await this.getByTelefone(telefone, clinicaId);
        if (pacienteExistente) {
            return pacienteExistente;
        }

        const novoPaciente = await this.create(
            {
                nome: `Paciente ${telefone.slice(-4)}`,
                telefone,
            },
            clinicaId,
        );

        return novoPaciente;
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