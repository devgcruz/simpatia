import { prisma } from '../lib/prisma';

interface IFiltrosAgendamento {
    doutorId?: number;
    dataInicio?: Date;
    dataFim?: Date;
}

interface ICreateAgendamento {
    dataHora: Date | string;
    status: string;
    pacienteId: number;
    doutorId: number;
    servicoId: number;
}

interface IUpdateAgendamento {
    dataHora?: Date | string;
    status?: string;
    pacienteId?: number;
    doutorId?: number;
    servicoId?: number;
}

class AgendamentoService {

    async getAll(filtros: IFiltrosAgendamento = {}) {
        const { doutorId, dataInicio, dataFim } = filtros;

        // Construir a cláusula where dinamicamente
        const where: any = {};

        if (doutorId !== undefined) {
            where.doutorId = doutorId;
        }

        if (dataInicio || dataFim) {
            where.dataHora = {};
            if (dataInicio) {
                where.dataHora.gte = new Date(dataInicio);
            }
            if (dataFim) {
                where.dataHora.lte = new Date(dataFim);
            }
        }

        const agendamentos = await prisma.agendamento.findMany({
            where,
            include: {
                paciente: true,
                doutor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true
                    }
                },
                servico: true
            },
            orderBy: {
                dataHora: 'asc'
            }
        });

        return agendamentos;
    }

    async getById(id: number) {
        const agendamento = await prisma.agendamento.findUnique({
            where: { id },
            include: {
                paciente: true,
                doutor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true
                    }
                },
                servico: true
            }
        });

        if (!agendamento) {
            throw new Error("Agendamento não encontrado.");
        }

        return agendamento;
    }

    async create(data: ICreateAgendamento) {
        const { dataHora, status, pacienteId, doutorId, servicoId } = data;

        if (!dataHora || !status || !pacienteId || !doutorId || !servicoId) {
            throw new Error("dataHora, status, pacienteId, doutorId e servicoId são obrigatórios.");
        }

        // Verificar se o paciente existe
        const pacienteExistente = await prisma.paciente.findUnique({
            where: { id: pacienteId },
        });

        if (!pacienteExistente) {
            throw new Error("Paciente não encontrado.");
        }

        // Verificar se o doutor existe
        const doutorExistente = await prisma.doutor.findUnique({
            where: { id: doutorId },
        });

        if (!doutorExistente) {
            throw new Error("Doutor não encontrado.");
        }

        // Verificar se o serviço existe
        const servicoExistente = await prisma.servico.findUnique({
            where: { id: servicoId },
        });

        if (!servicoExistente) {
            throw new Error("Serviço não encontrado.");
        }

        // Converter dataHora para Date se for string
        const dataHoraDate = typeof dataHora === 'string' ? new Date(dataHora) : dataHora;

        const novoAgendamento = await prisma.agendamento.create({
            data: {
                dataHora: dataHoraDate,
                status,
                pacienteId,
                doutorId,
                servicoId
            },
            include: {
                paciente: true,
                doutor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true
                    }
                },
                servico: true
            }
        });

        return novoAgendamento;
    }

    async update(id: number, data: IUpdateAgendamento) {
        const agendamentoExistente = await prisma.agendamento.findUnique({
            where: { id },
        });

        if (!agendamentoExistente) {
            throw new Error("Agendamento não encontrado.");
        }

        // Verificar se os IDs relacionados existem (se foram fornecidos)
        if (data.pacienteId && data.pacienteId !== agendamentoExistente.pacienteId) {
            const pacienteExistente = await prisma.paciente.findUnique({
                where: { id: data.pacienteId },
            });

            if (!pacienteExistente) {
                throw new Error("Paciente não encontrado.");
            }
        }

        if (data.doutorId && data.doutorId !== agendamentoExistente.doutorId) {
            const doutorExistente = await prisma.doutor.findUnique({
                where: { id: data.doutorId },
            });

            if (!doutorExistente) {
                throw new Error("Doutor não encontrado.");
            }
        }

        if (data.servicoId && data.servicoId !== agendamentoExistente.servicoId) {
            const servicoExistente = await prisma.servico.findUnique({
                where: { id: data.servicoId },
            });

            if (!servicoExistente) {
                throw new Error("Serviço não encontrado.");
            }
        }

        // Preparar dados para atualização
        const updateData: any = { ...data };

        // Converter dataHora para Date se for string
        if (data.dataHora) {
            updateData.dataHora = typeof data.dataHora === 'string' ? new Date(data.dataHora) : data.dataHora;
        }

        const agendamentoAtualizado = await prisma.agendamento.update({
            where: { id },
            data: updateData,
            include: {
                paciente: true,
                doutor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true
                    }
                },
                servico: true
            }
        });

        return agendamentoAtualizado;
    }

    async delete(id: number) {
        const agendamentoExistente = await prisma.agendamento.findUnique({
            where: { id },
        });

        if (!agendamentoExistente) {
            throw new Error("Agendamento não encontrado.");
        }

        await prisma.agendamento.delete({
            where: { id },
        });

        return { message: "Agendamento deletado com sucesso." };
    }
}

export default new AgendamentoService();

