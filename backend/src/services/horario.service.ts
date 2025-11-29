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

interface AuthUser {
    id: number;
    role: string;
    clinicaId: number;
}

class HorarioService {

    async getAll(user: AuthUser) {
        if (user.role === 'DOUTOR') {
            return prisma.horario.findMany({
                where: { doutorId: user.id },
            });
        }

        if (user.role === 'CLINICA_ADMIN') {
            return prisma.horario.findMany({
                where: {
                    doutor: {
                        clinicaId: user.clinicaId,
                    },
                },
            });
        }

        if (user.role === 'SUPER_ADMIN') {
            return prisma.horario.findMany();
        }

        return [];
    }

    async getById(id: number, user: AuthUser) {
        const horario = await prisma.horario.findUnique({
            where: { id },
        });

        if (!horario) {
            throw new Error("Horário não encontrado.");
        }

        await this.ensureAccessToHorario(horario, user);

        return horario;
    }

    async getByDoutorId(doutorId: number, user: AuthUser) {
        if (user.role === 'DOUTOR') {
            if (doutorId !== user.id) {
                throw new Error("Acesso negado.");
            }

            return prisma.horario.findMany({
                where: { 
                    doutorId: user.id,
                    ativo: true 
                },
            });
        }

        if (user.role === 'CLINICA_ADMIN') {
            const doutor = await prisma.doutor.findFirst({
                where: { id: doutorId, clinicaId: user.clinicaId },
            });

            if (!doutor) {
                throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
            }

            return prisma.horario.findMany({
                where: { 
                    doutorId,
                    ativo: true 
                },
            });
        }

        if (user.role === 'SUPER_ADMIN') {
            return prisma.horario.findMany({
                where: { 
                    doutorId,
                    ativo: true 
                },
            });
        }

        if (user.role === 'SECRETARIA') {
            // Verificar se o doutor está vinculado à secretária
            const vinculo = await prisma.secretariaDoutor.findFirst({
                where: {
                    secretariaId: user.id,
                    doutorId: doutorId,
                },
            });

            if (!vinculo) {
                throw new Error("Acesso negado. Doutor não está vinculado a esta secretária.");
            }

            return prisma.horario.findMany({
                where: { 
                    doutorId,
                    ativo: true 
                },
            });
        }

        return [];
    }

    async create(data: ICreateHorario, user: AuthUser) {
        const { diaSemana, inicio, fim, pausaInicio, pausaFim } = data;

        if (diaSemana === undefined || !inicio || !fim) {
            throw new Error("diaSemana, inicio e fim são obrigatórios.");
        }

        let targetDoutorId = data.doutorId;

        if (user.role === 'DOUTOR') {
            targetDoutorId = user.id;
        } else if (user.role === 'CLINICA_ADMIN') {
            if (!targetDoutorId) {
                throw new Error("doutorId é obrigatório.");
            }

            const doutor = await prisma.doutor.findFirst({
                where: { id: targetDoutorId, clinicaId: user.clinicaId, ativo: true },
            });

            if (!doutor) {
                throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
            }
        } else if (user.role === 'SUPER_ADMIN') {
            if (!targetDoutorId) {
                throw new Error("doutorId é obrigatório.");
            }
        } else {
            throw new Error("Acesso negado.");
        }

        const doutorExistente = await prisma.doutor.findFirst({
            where: { id: targetDoutorId, ativo: true },
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
                doutorId: targetDoutorId,
            },
        });

        return novoHorario;
    }

    async update(id: number, data: IUpdateHorario, user: AuthUser) {
        const horarioExistente = await prisma.horario.findUnique({
            where: { id },
        });

        if (!horarioExistente) {
            throw new Error("Horário não encontrado.");
        }

        await this.ensureAccessToHorario(horarioExistente, user);

        if (data.doutorId && data.doutorId !== horarioExistente.doutorId) {
            if (user.role === 'DOUTOR') {
                throw new Error("Acesso negado.");
            }

            if (user.role === 'CLINICA_ADMIN') {
                const doutor = await prisma.doutor.findFirst({
                    where: { id: data.doutorId, clinicaId: user.clinicaId },
                });

                if (!doutor) {
                    throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
                }
            }

            const doutorExistente = await prisma.doutor.findFirst({
                where: { id: data.doutorId, ativo: true },
            });

            if (!doutorExistente) {
                throw new Error("Doutor não encontrado.");
            }
        }

        const updateData: any = {};

        if (data.diaSemana !== undefined) updateData.diaSemana = data.diaSemana;
        if (data.inicio !== undefined) updateData.inicio = data.inicio;
        if (data.fim !== undefined) updateData.fim = data.fim;
        if (data.doutorId !== undefined) updateData.doutorId = data.doutorId;

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

    async delete(id: number, user: AuthUser) {
        const horarioExistente = await prisma.horario.findUnique({
            where: { id },
        });

        if (!horarioExistente) {
            throw new Error("Horário não encontrado.");
        }

        await this.ensureAccessToHorario(horarioExistente, user);

        await prisma.horario.update({
            where: { id },
            data: { ativo: false },
        });

        return { message: "Horário inativado com sucesso." };
    }

    private async ensureAccessToHorario(horario: { doutorId: number }, user: AuthUser) {
        if (user.role === 'DOUTOR') {
            if (horario.doutorId !== user.id) {
                throw new Error("Acesso negado.");
            }
            return;
        }

        if (user.role === 'CLINICA_ADMIN') {
            const doutor = await prisma.doutor.findFirst({
                where: { id: horario.doutorId, clinicaId: user.clinicaId, ativo: true },
            });

            if (!doutor) {
                throw new Error("Acesso negado.");
            }
        }
    }
}

export default new HorarioService();

