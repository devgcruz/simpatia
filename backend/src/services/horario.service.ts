import { prisma } from '../lib/prisma';

interface ICreateHorario {
    diaSemana: number;
    inicio: string;
    fim: string;
    pausaInicio?: string;
    pausaFim?: string;
    doutorId: number;
}

interface IUpdateHorario {
    diaSemana?: number;
    inicio?: string;
    fim?: string;
    pausaInicio?: string;
    pausaFim?: string;
    doutorId?: number;
}

class HorarioService {

    async getAll() {
        const horarios = await prisma.horario.findMany();
        return horarios;
    }

    async getById(id: number) {
        const horario = await prisma.horario.findUnique({
            where: { id },
        });

        if (!horario) {
            throw new Error("Horário não encontrado.");
        }

        return horario;
    }

    async getByDoutorId(doutorId: number) {
        const horarios = await prisma.horario.findMany({
            where: { doutorId: doutorId },
        });

        return horarios;
    }

    async create(data: ICreateHorario) {
        const { diaSemana, inicio, fim, pausaInicio, pausaFim, doutorId } = data;

        if (diaSemana === undefined || !inicio || !fim || !doutorId) {
            throw new Error("diaSemana, inicio, fim e doutorId são obrigatórios.");
        }

        // Verificar se o doutor existe
        const doutorExistente = await prisma.doutor.findUnique({
            where: { id: doutorId },
        });

        if (!doutorExistente) {
            throw new Error("Doutor não encontrado.");
        }

        const novoHorario = await prisma.horario.create({
            data: {
                diaSemana,
                inicio,
                fim,
                pausaInicio: pausaInicio || null,
                pausaFim: pausaFim || null,
                doutorId,
            },
        });

        return novoHorario;
    }

    async update(id: number, data: IUpdateHorario) {
        const horarioExistente = await prisma.horario.findUnique({
            where: { id },
        });

        if (!horarioExistente) {
            throw new Error("Horário não encontrado.");
        }

        // Se um novo doutorId foi fornecido, verificar se existe
        if (data.doutorId && data.doutorId !== horarioExistente.doutorId) {
            const doutorExistente = await prisma.doutor.findUnique({
                where: { id: data.doutorId },
            });

            if (!doutorExistente) {
                throw new Error("Doutor não encontrado.");
            }
        }

        // Construir objeto de atualização explicitamente
        const updateData: any = {};
        
        if (data.diaSemana !== undefined) updateData.diaSemana = data.diaSemana;
        if (data.inicio !== undefined) updateData.inicio = data.inicio;
        if (data.fim !== undefined) updateData.fim = data.fim;
        if (data.doutorId !== undefined) updateData.doutorId = data.doutorId;
        
        // Tratar pausaInicio e pausaFim: se for string vazia, definir como null, senão manter o valor ou undefined
        if ('pausaInicio' in data) {
            updateData.pausaInicio = data.pausaInicio === '' ? null : data.pausaInicio;
        }
        if ('pausaFim' in data) {
            updateData.pausaFim = data.pausaFim === '' ? null : data.pausaFim;
        }

        const horarioAtualizado = await prisma.horario.update({
            where: { id },
            data: updateData,
        });

        return horarioAtualizado;
    }

    async delete(id: number) {
        const horarioExistente = await prisma.horario.findUnique({
            where: { id },
        });

        if (!horarioExistente) {
            throw new Error("Horário não encontrado.");
        }

        await prisma.horario.delete({
            where: { id },
        });

        return { message: "Horário deletado com sucesso." };
    }
}

export default new HorarioService();

