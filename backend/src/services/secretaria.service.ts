import { prisma } from '../lib/prisma';

interface ICreateSecretaria {
  nome: string;
  email: string;
  senha: string;
  clinicaId: number;
  doutorIds: number[]; // IDs dos doutores vinculados
}

interface IUpdateSecretaria {
  nome?: string;
  email?: string;
  senha?: string;
  doutorIds?: number[]; // IDs dos doutores vinculados
}

class SecretariaService {
  async getAll(clinicaId: number) {
    const secretarias = await prisma.doutor.findMany({
      where: {
        role: 'SECRETARIA',
        clinicaId,
        ativo: true,
      },
      include: {
        secretarias: {
          include: {
            doutor: {
              select: {
                id: true,
                nome: true,
                email: true,
                especialidade: true,
              },
            },
          },
        },
        clinica: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: {
        nome: 'asc',
      },
    });

    return secretarias.map((secretaria) => ({
      id: secretaria.id,
      nome: secretaria.nome,
      email: secretaria.email,
      clinicaId: secretaria.clinicaId,
      clinica: secretaria.clinica,
      doutoresVinculados: secretaria.secretarias.map((v) => v.doutor),
      createdAt: secretaria.createdAt,
      updatedAt: secretaria.updatedAt,
    }));
  }

  async getById(id: number, clinicaId: number) {
    const secretaria = await prisma.doutor.findFirst({
      where: {
        id,
        role: 'SECRETARIA',
        clinicaId,
        ativo: true,
      },
      include: {
        secretarias: {
          include: {
            doutor: {
              select: {
                id: true,
                nome: true,
                email: true,
                especialidade: true,
              },
            },
          },
        },
        clinica: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!secretaria) {
      throw new Error('Secretária não encontrada.');
    }

    return {
      id: secretaria.id,
      nome: secretaria.nome,
      email: secretaria.email,
      clinicaId: secretaria.clinicaId,
      clinica: secretaria.clinica,
      doutoresVinculados: secretaria.secretarias.map((v) => v.doutor),
      createdAt: secretaria.createdAt,
      updatedAt: secretaria.updatedAt,
    };
  }

  async create(data: ICreateSecretaria) {
    const { nome, email, senha, clinicaId, doutorIds } = data;

    // Verificar se o email já existe
    const emailExistente = await prisma.doutor.findUnique({
      where: { email },
    });

    if (emailExistente) {
      throw new Error('Email já cadastrado.');
    }

    // Verificar se todos os doutores pertencem à mesma clínica
    if (doutorIds && doutorIds.length > 0) {
      const doutores = await prisma.doutor.findMany({
        where: {
          id: { in: doutorIds },
          clinicaId,
          ativo: true,
        },
      });

      if (doutores.length !== doutorIds.length) {
        throw new Error('Um ou mais doutores não pertencem a esta clínica ou não estão ativos.');
      }
    }

    // Criar secretária e vínculos em uma transação
    const secretaria = await prisma.$transaction(async (tx) => {
      // Criar o doutor com role SECRETARIA
      const novaSecretaria = await tx.doutor.create({
        data: {
          nome,
          email,
          senha,
          role: 'SECRETARIA',
          clinicaId,
          ativo: true,
        },
      });

      // Criar vínculos com doutores
      if (doutorIds && doutorIds.length > 0) {
        await tx.secretariaDoutor.createMany({
          data: doutorIds.map((doutorId) => ({
            secretariaId: novaSecretaria.id,
            doutorId,
          })),
        });
      }

      // Retornar com os vínculos
      return await tx.doutor.findUnique({
        where: { id: novaSecretaria.id },
        include: {
          secretarias: {
            include: {
              doutor: {
                select: {
                  id: true,
                  nome: true,
                  email: true,
                  especialidade: true,
                },
              },
            },
          },
          clinica: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      });
    });

    return {
      id: secretaria!.id,
      nome: secretaria!.nome,
      email: secretaria!.email,
      clinicaId: secretaria!.clinicaId,
      clinica: secretaria!.clinica,
      doutoresVinculados: secretaria!.secretarias.map((v) => v.doutor),
      createdAt: secretaria!.createdAt,
      updatedAt: secretaria!.updatedAt,
    };
  }

  async update(id: number, data: IUpdateSecretaria, clinicaId: number) {
    const secretariaExistente = await prisma.doutor.findFirst({
      where: {
        id,
        role: 'SECRETARIA',
        clinicaId,
        ativo: true,
      },
    });

    if (!secretariaExistente) {
      throw new Error('Secretária não encontrada.');
    }

    // Verificar se o email já existe em outro registro
    if (data.email && data.email !== secretariaExistente.email) {
      const emailExistente = await prisma.doutor.findUnique({
        where: { email: data.email },
      });

      if (emailExistente && emailExistente.id !== id) {
        throw new Error('Email já cadastrado.');
      }
    }

    // Verificar se todos os doutores pertencem à mesma clínica
    if (data.doutorIds && data.doutorIds.length > 0) {
      const doutores = await prisma.doutor.findMany({
        where: {
          id: { in: data.doutorIds },
          clinicaId,
          ativo: true,
        },
      });

      if (doutores.length !== data.doutorIds.length) {
        throw new Error('Um ou mais doutores não pertencem a esta clínica ou não estão ativos.');
      }
    }

    // Atualizar secretária e vínculos em uma transação
    const secretaria = await prisma.$transaction(async (tx) => {
      // Atualizar dados básicos
      const updateData: any = {};
      if (data.nome) updateData.nome = data.nome;
      if (data.email) updateData.email = data.email;
      if (data.senha) updateData.senha = data.senha;

      await tx.doutor.update({
        where: { id },
        data: updateData,
      });

      // Atualizar vínculos se fornecido
      if (data.doutorIds !== undefined) {
        // Remover vínculos existentes
        await tx.secretariaDoutor.deleteMany({
          where: { secretariaId: id },
        });

        // Criar novos vínculos
        if (data.doutorIds.length > 0) {
          await tx.secretariaDoutor.createMany({
            data: data.doutorIds.map((doutorId) => ({
              secretariaId: id,
              doutorId,
            })),
          });
        }
      }

      // Retornar com os vínculos atualizados
      return await tx.doutor.findUnique({
        where: { id },
        include: {
          secretarias: {
            include: {
              doutor: {
                select: {
                  id: true,
                  nome: true,
                  email: true,
                  especialidade: true,
                },
              },
            },
          },
          clinica: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      });
    });

    return {
      id: secretaria!.id,
      nome: secretaria!.nome,
      email: secretaria!.email,
      clinicaId: secretaria!.clinicaId,
      clinica: secretaria!.clinica,
      doutoresVinculados: secretaria!.secretarias.map((v) => v.doutor),
      createdAt: secretaria!.createdAt,
      updatedAt: secretaria!.updatedAt,
    };
  }

  async delete(id: number, clinicaId: number) {
    const secretariaExistente = await prisma.doutor.findFirst({
      where: {
        id,
        role: 'SECRETARIA',
        clinicaId,
        ativo: true,
      },
    });

    if (!secretariaExistente) {
      throw new Error('Secretária não encontrada.');
    }

    // Soft delete
    await prisma.doutor.update({
      where: { id },
      data: { ativo: false },
    });

    return { message: 'Secretária excluída com sucesso.' };
  }

  // Obter IDs dos doutores vinculados a uma secretária
  async getDoutoresVinculados(secretariaId: number): Promise<number[]> {
    const vinculos = await prisma.secretariaDoutor.findMany({
      where: { secretariaId },
      select: { doutorId: true },
    });

    return vinculos.map((v) => v.doutorId);
  }
}

export default new SecretariaService();


