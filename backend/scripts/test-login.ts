import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function testLogin() {
  try {
    const email = 'admin@mail.com';
    const senha = 'admin';

    // Buscar o doutor pelo email
    const doutor = await prisma.doutor.findUnique({
      where: { email }
    });

    if (!doutor) {
      console.log('❌ Usuário não encontrado!');
      console.log('   Email procurado:', email);
      return;
    }

    console.log('✅ Usuário encontrado:');
    console.log(`   ID: ${doutor.id}`);
    console.log(`   Nome: ${doutor.nome}`);
    console.log(`   Email: ${doutor.email}`);
    console.log(`   Hash da senha: ${doutor.senha.substring(0, 20)}...`);

    // Testar a senha
    const senhaValida = await bcrypt.compare(senha, doutor.senha);
    
    if (senhaValida) {
      console.log('✅ Senha válida!');
    } else {
      console.log('❌ Senha inválida!');
      console.log('   Tentando recriar o hash da senha...');
      
      // Recriar o hash da senha
      const novoHash = await bcrypt.hash(senha, 10);
      await prisma.doutor.update({
        where: { id: doutor.id },
        data: { senha: novoHash }
      });
      
      console.log('✅ Hash da senha atualizado!');
      console.log('   Tente fazer login novamente.');
    }
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();

