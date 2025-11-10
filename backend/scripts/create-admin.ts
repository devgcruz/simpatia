import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function createAdmin() {
  try {
    const email = 'admin@mail.com';
    const senha = 'admin';
    const nome = 'Administrador';

    // Verificar se o admin já existe
    const adminExistente = await prisma.doutor.findUnique({
      where: { email },
    });

    if (adminExistente) {
      console.log('❌ Usuário admin já existe!');
      console.log(`   Email: ${adminExistente.email}`);
      console.log(`   Nome: ${adminExistente.nome}`);
      return;
    }

    // Fazer hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar o usuário admin
    const admin = await prisma.doutor.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        role: 'SUPER_ADMIN',
      },
    });

    console.log('✅ Usuário admin criado com sucesso!');
    console.log(`   ID: ${admin.id}`);
    console.log(`   Nome: ${admin.nome}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Senha: admin (hash armazenado)`);
  } catch (error: any) {
    console.error('❌ Erro ao criar usuário admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

