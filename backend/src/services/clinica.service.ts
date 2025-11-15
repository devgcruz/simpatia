import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

interface ICreateClinicaEAdmin {
  nome: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  adminNome: string;
  adminEmail: string;
  adminSenha: string;
}

interface IUpdateClinica {
  nome?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
  webhookUrlId?: string;
  webhookVerifyToken?: string;
}

class ClinicaService {
  async getAll() {
    return prisma.clinica.findMany();
  }

  async getById(id: number) {
    return prisma.clinica.findUnique({ where: { id } });
  }

  async createClinicaEAdmin(data: ICreateClinicaEAdmin) {
    const { nome, cnpj, endereco, telefone, adminNome, adminEmail, adminSenha } = data;
    const hashSenha = await bcrypt.hash(adminSenha, 10);

    try {
      return await prisma.clinica.create({
        data: {
          nome,
          cnpj,
          endereco,
          telefone,
          doutores: {
            create: {
              nome: adminNome,
              email: adminEmail,
              senha: hashSenha,
              role: 'CLINICA_ADMIN',
            },
          },
        },
        include: {
          doutores: true,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        throw new Error('Este email já está a ser utilizado por outro doutor.');
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('cnpj')) {
        throw new Error('Este CNPJ já está a ser utilizado por outra clínica.');
      }
      throw error;
    }
  }

  async update(id: number, data: IUpdateClinica) {
    return prisma.clinica.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    return prisma.clinica.delete({ where: { id } });
  }

  async renovarWebhookVerifyToken(id: number) {
    const novoToken = randomUUID();
    
    return prisma.clinica.update({
      where: { id },
      data: {
        webhookVerifyToken: novoToken,
      },
    });
  }
}

export default new ClinicaService();

