import { prisma } from '../lib/prisma';

interface IFiltrosAgendamento {
    doutorId?: string;
    dataInicio?: string;
    dataFim?: string;
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

interface AuthUser {
    id: number;
    role: string;
    clinicaId: number;
}

const agendamentoInclude = {
    paciente: true,
    doutor: {
        select: {
            id: true,
            nome: true,
            email: true,
            clinicaId: true,
        },
    },
    servico: true,
};

class AgendamentoService {

    async getAll(user: AuthUser, filtros: IFiltrosAgendamento = {}) {
        const where: any = {};

        if (filtros.dataInicio && filtros.dataFim) {
            where.dataHora = {
                gte: new Date(filtros.dataInicio),
                lte: new Date(filtros.dataFim),
            };
        } else if (filtros.dataInicio) {
            where.dataHora = { gte: new Date(filtros.dataInicio) };
        } else if (filtros.dataFim) {
            where.dataHora = { lte: new Date(filtros.dataFim) };
        }

        if (user.role === 'DOUTOR') {
            where.doutorId = user.id;
        } else if (user.role === 'CLINICA_ADMIN') {
            where.doutor = { clinicaId: user.clinicaId };

            if (filtros.doutorId) {
                where.doutorId = Number(filtros.doutorId);
            }
        } else if (user.role === 'SUPER_ADMIN') {
            if (filtros.doutorId) {
                where.doutorId = Number(filtros.doutorId);
            }
        } else {
            return [];
        }

        const agendamentos = await prisma.agendamento.findMany({
            where,
            include: agendamentoInclude,
            orderBy: { dataHora: 'asc' },
        });

        return agendamentos.map(({ doutor, ...rest }) => ({
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        }));
    }

    async getById(id: number, user: AuthUser) {
        const agendamento = await prisma.agendamento.findUnique({
            where: { id },
            include: agendamentoInclude,
        });

        if (!agendamento) {
            throw new Error("Agendamento não encontrado.");
        }

        await this.ensureAccessToAgendamento(agendamento, user);

        const { doutor, ...rest } = agendamento;
        return {
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        };
    }

    async create(data: ICreateAgendamento, user: AuthUser) {
        const { dataHora, status, pacienteId, servicoId } = data;

        if (!dataHora || !status || !pacienteId || !servicoId) {
            throw new Error("dataHora, status, pacienteId e servicoId são obrigatórios.");
        }

        let targetDoutorId = data.doutorId;

        if (user.role === 'DOUTOR') {
            targetDoutorId = user.id;
        } else if (user.role === 'CLINICA_ADMIN') {
            if (!targetDoutorId) {
                throw new Error("doutorId é obrigatório.");
            }
        } else if (user.role !== 'SUPER_ADMIN') {
            throw new Error("Acesso negado.");
        }

        if (user.role !== 'SUPER_ADMIN') {
            await this.ensureEntitiesBelongToClinica({
                doutorId: targetDoutorId,
                pacienteId,
                servicoId,
                clinicaId: user.clinicaId,
            });
        } else {
            await this.ensureEntitiesExist({
                doutorId: targetDoutorId,
                pacienteId,
                servicoId,
            });
        }

        const dataHoraDate = typeof dataHora === 'string' ? new Date(dataHora) : dataHora;

        const novoAgendamento = await prisma.agendamento.create({
            data: {
                dataHora: dataHoraDate,
                status,
                pacienteId,
                doutorId: targetDoutorId,
                servicoId,
            },
            include: agendamentoInclude,
        });

        const { doutor, ...rest } = novoAgendamento;
        return {
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        };
    }

    async update(id: number, data: IUpdateAgendamento, user: AuthUser) {
        const agendamentoExistente = await prisma.agendamento.findUnique({
            where: { id },
            include: agendamentoInclude,
        });

        if (!agendamentoExistente) {
            throw new Error("Agendamento não encontrado.");
        }

        await this.ensureAccessToAgendamento(agendamentoExistente, user);

        if (data.doutorId && data.doutorId !== agendamentoExistente.doutorId) {
            if (user.role === 'DOUTOR') {
                throw new Error("Acesso negado.");
            }
        }

        const targetDoutorId = data.doutorId ?? agendamentoExistente.doutorId;
        const targetPacienteId = data.pacienteId ?? agendamentoExistente.pacienteId;
        const targetServicoId = data.servicoId ?? agendamentoExistente.servicoId;

        if (user.role !== 'SUPER_ADMIN') {
            await this.ensureEntitiesBelongToClinica({
                doutorId: targetDoutorId,
                pacienteId: targetPacienteId,
                servicoId: targetServicoId,
                clinicaId: user.clinicaId,
            });
        } else {
            await this.ensureEntitiesExist({
                doutorId: targetDoutorId,
                pacienteId: targetPacienteId,
                servicoId: targetServicoId,
            });
        }

        const updateData: any = { ...data };
        if (data.dataHora) {
            updateData.dataHora = typeof data.dataHora === 'string' ? new Date(data.dataHora) : data.dataHora;
        }

        const agendamentoAtualizado = await prisma.agendamento.update({
            where: { id },
            data: updateData,
            include: agendamentoInclude,
        });

        const { doutor, ...rest } = agendamentoAtualizado;
        return {
            ...rest,
            doutor: {
                id: doutor.id,
                nome: doutor.nome,
                email: doutor.email,
            },
        };
    }

    async delete(id: number, user: AuthUser) {
        const agendamentoExistente = await prisma.agendamento.findUnique({
            where: { id },
            include: agendamentoInclude,
        });

        if (!agendamentoExistente) {
            throw new Error("Agendamento não encontrado.");
        }

        await this.ensureAccessToAgendamento(agendamentoExistente, user);

        await prisma.agendamento.delete({
            where: { id },
        });

        return { message: "Agendamento deletado com sucesso." };
    }

    private async ensureAccessToAgendamento(agendamento: any, user: AuthUser) {
        if (user.role === 'DOUTOR') {
            if (agendamento.doutorId !== user.id) {
                throw new Error("Acesso negado.");
            }
        } else if (user.role === 'CLINICA_ADMIN') {
            if (agendamento.doutor.clinicaId !== user.clinicaId) {
                throw new Error("Acesso negado.");
            }
        }
    }

    private async ensureEntitiesBelongToClinica(params: { doutorId: number; pacienteId: number; servicoId: number; clinicaId: number; }) {
        const { doutorId, pacienteId, servicoId, clinicaId } = params;

        const [doutor, paciente, servico] = await Promise.all([
            prisma.doutor.findFirst({ where: { id: doutorId, clinicaId } }),
            prisma.paciente.findFirst({ where: { id: pacienteId, clinicaId } }),
            prisma.servico.findFirst({ where: { id: servicoId, clinicaId } }),
        ]);

        if (!doutor || !paciente || !servico) {
            throw new Error("Doutor, Paciente ou Serviço não encontrado ou não pertence à esta clínica.");
        }
    }

    private async ensureEntitiesExist(params: { doutorId: number; pacienteId: number; servicoId: number; }) {
        const { doutorId, pacienteId, servicoId } = params;

        const [doutor, paciente, servico] = await Promise.all([
            prisma.doutor.findUnique({ where: { id: doutorId } }),
            prisma.paciente.findUnique({ where: { id: pacienteId } }),
            prisma.servico.findUnique({ where: { id: servicoId } }),
        ]);

        if (!doutor) {
            throw new Error("Doutor não encontrado.");
        }
        if (!paciente) {
            throw new Error("Paciente não encontrado.");
        }
        if (!servico) {
            throw new Error("Serviço não encontrado.");
        }
    }
}

export default new AgendamentoService();

