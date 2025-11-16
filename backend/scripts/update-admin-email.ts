import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function updateAdminEmail() {
  try {
    // Buscar o usuário admin atual (pode ser pelo ID 1 ou pelo email antigo)
    const admin = await prisma.doutor.findFirst({
      where: {
        OR: [
          { email: 'admin' },
          { id: 1 }
        ]
      }
    });

    if (!admin) {
      console.log('❌ Usuário admin não encontrado!');
      return;
    }

    // Verificar se o novo email já existe
    const emailExistente = await prisma.doutor.findUnique({
      where: { email: 'admin@mail.com' },
    });

    if (emailExistente && emailExistente.id !== admin.id) {
      console.log('❌ O email admin@mail.com já está em uso por outro usuário!');
      return;
    }

    // Atualizar o email e a senha para 'admin'
    const senhaHash = await bcrypt.hash('admin', 10);

    const adminAtualizado = await prisma.doutor.update({
      where: { id: admin.id },
      data: { email: 'admin@mail.com', senha: senhaHash },
    });

    console.log('✅ Email e senha do usuário admin atualizados com sucesso!');
    console.log(`   ID: ${adminAtualizado.id}`);
    console.log(`   Nome: ${adminAtualizado.nome}`);
    console.log(`   Email: ${adminAtualizado.email}`);
    console.log(`   Senha: admin (hash armazenado)`);
  } catch (error: any) {
    console.error('❌ Erro ao atualizar email do admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminEmail();

