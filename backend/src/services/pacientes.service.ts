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

    async getAll(clinicaId: number, userId?: number, userRole?: string, doutorId?: number) {
        const where: any = { clinicaId, ativo: true };
        
        // Se for DOUTOR, filtrar apenas pacientes do doutor logado
        if (userRole === 'DOUTOR' && userId) {
            where.doutorId = userId;
        }
        // Se for SECRETARIA, filtrar apenas pacientes dos doutores vinculados
        else if (userRole === 'SECRETARIA' && userId) {
            const vinculos = await prisma.secretariaDoutor.findMany({
                where: { secretariaId: userId },
                select: { doutorId: true },
            });
            const doutorIds = vinculos.map((v) => v.doutorId);
            
            if (doutorIds.length === 0) {
                return []; // Secretária sem vínculos não vê nada
            }
            
            // Se doutorId específico foi fornecido, verificar se está nos vínculos
            if (doutorId) {
                if (doutorIds.includes(doutorId)) {
                    where.doutorId = doutorId;
                } else {
                    return []; // Doutor não vinculado
                }
            } else {
                where.doutorId = { in: doutorIds };
            }
        } else if (doutorId) {
            // Para outros roles, se doutorId foi fornecido, filtrar por ele
            where.doutorId = doutorId;
        }
        
        const paciente = await prisma.paciente.findMany({
            where,
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
            where: { id, clinicaId, ativo: true },
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
            where: { id, clinicaId, ativo: true },
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
                        prescricoes: {
                            select: {
                                id: true,
                                protocolo: true,
                                conteudo: true,
                                createdAt: true,
                                agendamentoId: true,
                            },
                            orderBy: {
                                createdAt: 'desc',
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

        // Buscar prescrições avulsas (sem agendamento) do paciente
        const prescricoesAvulsas = await prisma.prescricao.findMany({
            where: {
                pacienteId: id,
                agendamentoId: null,
            },
            select: {
                id: true,
                protocolo: true,
                conteudo: true,
                createdAt: true,
                doutor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return historicos.map((historico) => {
            const { agendamento, ...rest } = historico;
            return {
                id: rest.id,
                protocolo: rest.protocolo,
                descricao: rest.descricao,
                realizadoEm: rest.realizadoEm,
                criadoEm: rest.createdAt,
                duracaoMinutos: rest.duracaoMinutos,
                agendamentoId: rest.agendamentoId,
                agendamento: agendamento
                ? {
                    id: agendamento.id,
                    dataHora: agendamento.dataHora,
                    servico: {
                        nome: agendamento.servico.nome,
                        duracaoMin: agendamento.servico.duracaoMin,
                    },
                    prescricoes: (agendamento.prescricoes || []).map((p: any) => ({
                        ...p,
                        agendamentoId: agendamento.id,
                    })),
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
                prescricoes: agendamento?.prescricoes || [],
            };
        }).concat(
            // Adicionar prescrições avulsas como "históricos" especiais
            prescricoesAvulsas.map((prescricao) => ({
                id: `prescricao-${prescricao.id}`, // ID especial para identificar como prescrição avulsa
                protocolo: `prescricao-${prescricao.protocolo}`,
                descricao: 'Prescrição Fora do Atendimento',
                realizadoEm: prescricao.createdAt,
                criadoEm: prescricao.createdAt,
                duracaoMinutos: null,
                agendamentoId: null,
                agendamento: null,
                servico: null,
                doutor: prescricao.doutor ? {
                    id: prescricao.doutor.id,
                    nome: prescricao.doutor.nome,
                    email: prescricao.doutor.email,
                } : null,
                prescricoes: [{
                    id: prescricao.id,
                    protocolo: prescricao.protocolo,
                    conteudo: prescricao.conteudo,
                    createdAt: prescricao.createdAt,
                    agendamentoId: null, // Marca como prescrição avulsa
                }],
            }))
        );
    }

    async getByTelefone(telefone: string, clinicaId: number) {
        const paciente = await prisma.paciente.findFirst({
            where: { telefone, clinicaId, ativo: true },
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

    async updateHistorico(historicoId: number, descricao: string, clinicaId: number) {
        if (!descricao || !descricao.trim()) {
            throw new Error("A descrição do atendimento é obrigatória.");
        }

        const historico = await prisma.historicoPaciente.findUnique({
            where: { id: historicoId },
            include: {
                paciente: true,
            },
        });

        if (!historico) {
            throw new Error("Histórico não encontrado.");
        }

        if (historico.paciente.clinicaId !== clinicaId) {
            throw new Error("Histórico não pertence a esta clínica.");
        }

        const historicoAtualizado = await prisma.historicoPaciente.update({
            where: { id: historicoId },
            data: {
                descricao: descricao.trim(),
            },
        });

        return historicoAtualizado;
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
            where: { telefone, clinicaId, ativo: true },
        });

        if(telefoneExistente){
            throw new Error("Esse telefone já esta cadastrado.");
        }

        // Validar CPF único (se fornecido)
        if (cpf) {
            const cpfExistente = await prisma.paciente.findFirst({
                where: { cpf, clinicaId, ativo: true } as any,
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
                    ativo: true,
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
            where: { id, clinicaId, ativo: true },
        });

        if (!pacienteExistente){
            throw new Error("Paciente não encontrado ou não pertence à esta clínica.");
        }

        // Validar CPF único (se fornecido e diferente do atual)
        if (data.cpf && data.cpf !== (pacienteExistente as any).cpf) {
            const cpfExistente = await prisma.paciente.findFirst({
                where: { cpf: data.cpf, clinicaId, ativo: true } as any,
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
                        ativo: true,
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
            where: { id, clinicaId, ativo: true },
        });

        if (!pacienteExistente) {
            throw new Error("Paciente não encontrado ou não pertence à esta clínica.");
        }

        await prisma.paciente.update({
            where: { id },
            data: { ativo: false },
        });

        return { message: "Paciente inativado com sucesso."};
    }


}

export default new PacienteService();