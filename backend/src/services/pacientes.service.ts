import { prisma } from '../lib/prisma';

interface ICreatePaciente {
    nome: string;
    telefone: string;
    cpf?: string;
    dataNascimento?: Date | string;
    genero?: string;
    email?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    convenio?: string;
    numeroCarteirinha?: string;
    alergias?: string;
    observacoes?: string;
    doutorId?: number;
    pesoKg?: number;
    alturaCm?: number;
}

interface IUpdatePaciente {
    nome?: string;
    telefone?: string;
    cpf?: string;
    dataNascimento?: Date | string;
    genero?: string;
    email?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    convenio?: string;
    numeroCarteirinha?: string;
    alergias?: string;
    observacoes?: string;
    doutorId?: number;
    pesoKg?: number;
    alturaCm?: number;
}
class PacienteService {

    async getAll(clinicaId: number) {
        const paciente = await prisma.paciente.findMany({
            where: { clinicaId },
            include: {
                doutor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
            } as any,
        });
        return paciente;
    }

    async getById(id: number, clinicaId: number) {
        const paciente = await prisma.paciente.findFirst({
            where: { id, clinicaId },
            include: {
                doutor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
            } as any,
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

        const historicos = await prisma.historicoPaciente.findMany({
            where: { pacienteId: id },
            include: {
                agendamento: {
                    include: {
                        servico: {
                            select: {
                                nome: true,
                                duracaoMin: true,
                            },
                        },
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

        return historicos.map((historico) => {
            const { agendamento, ...rest } = historico;
            return {
                id: rest.id,
                protocolo: rest.protocolo,
                descricao: rest.descricao,
                realizadoEm: rest.realizadoEm,
                criadoEm: rest.createdAt,
                agendamentoId: rest.agendamentoId,
                agendamento: agendamento
                ? {
                    id: agendamento.id,
                    dataHora: agendamento.dataHora,
                    servico: {
                        nome: agendamento.servico.nome,
                        duracaoMin: agendamento.servico.duracaoMin,
                    },
                }
                : null,
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
            include: {
                doutor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
            } as any,
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
        const { 
            nome, 
            telefone, 
            cpf,
            dataNascimento,
            genero,
            email,
            cep,
            logradouro,
            numero,
            bairro,
            cidade,
            estado,
            convenio,
            numeroCarteirinha,
            alergias,
            observacoes,
            doutorId,
            pesoKg,
            alturaCm,
        } = data;

        if (!nome || !telefone) {
            throw new Error("Nome, Telefone são obrigatórios.");
        }

        const telefoneExistente = await prisma.paciente.findFirst({
            where: { telefone, clinicaId },
        });

        if(telefoneExistente){
            throw new Error("Esse telefone já esta cadastrado.");
        }

        // Validar CPF único (se fornecido)
        if (cpf) {
            const cpfExistente = await prisma.paciente.findFirst({
                where: { cpf, clinicaId } as any,
            });

            if (cpfExistente) {
                throw new Error("Esse CPF já está cadastrado.");
            }
        }

        // Validar se o doutor existe e pertence à mesma clínica (se doutorId for fornecido)
        if (doutorId) {
            const doutor = await prisma.doutor.findFirst({
                where: { 
                    id: doutorId,
                    clinicaId: clinicaId,
                },
            });

            if (!doutor) {
                throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
            }
        }

        // Converter dataNascimento para Date se for string
        const dataNasc = dataNascimento 
            ? (typeof dataNascimento === 'string' ? new Date(dataNascimento) : dataNascimento)
            : null;

        const novoPaciente = await prisma.paciente.create({
            data: {
                nome,
                telefone,
                cpf: cpf || null,
                dataNascimento: dataNasc,
                genero: genero || null,
                email: email || null,
                cep: cep || null,
                logradouro: logradouro || null,
                numero: numero || null,
                bairro: bairro || null,
                cidade: cidade || null,
                estado: estado || null,
                convenio: convenio || null,
                numeroCarteirinha: numeroCarteirinha || null,
                alergias: alergias || null,
                observacoes: observacoes || null,
                pesoKg: pesoKg ?? null,
                alturaCm: alturaCm ?? null,
                clinicaId,
                doutorId: doutorId || null,
            } as any,
            include: {
                doutor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
            } as any,
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

        // Validar CPF único (se fornecido e diferente do atual)
        if (data.cpf && data.cpf !== (pacienteExistente as any).cpf) {
            const cpfExistente = await prisma.paciente.findFirst({
                where: { cpf: data.cpf, clinicaId } as any,
            });

            if (cpfExistente && cpfExistente.id !== id) {
                throw new Error("Esse CPF já está cadastrado para outro paciente.");
            }
        }

        // Validar se o doutor existe e pertence à mesma clínica (se doutorId for fornecido)
        if (data.doutorId !== undefined) {
            if (data.doutorId !== null) {
                const doutor = await prisma.doutor.findFirst({
                    where: { 
                        id: data.doutorId,
                        clinicaId: clinicaId,
                    },
                });

                if (!doutor) {
                    throw new Error("Doutor não encontrado ou não pertence à esta clínica.");
                }
            }
        }

        // Converter dataNascimento para Date se for string
        const updateData: any = { ...data };
        if (data.dataNascimento !== undefined) {
            updateData.dataNascimento = data.dataNascimento 
                ? (typeof data.dataNascimento === 'string' ? new Date(data.dataNascimento) : data.dataNascimento)
                : null;
        }

        const pacienteAtualizado = await prisma.paciente.update({
            where: { id },
            data: updateData as any,
            include: {
                doutor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
            } as any,
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

        return { message: "Paciente deletado com sucesso."};
    }


}

export default new PacienteService();