import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testando conexão com o banco de dados...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
    
    await prisma.$connect();
    console.log('✅ Conexão com o banco de dados estabelecida com sucesso!');
    
    // Testar uma query simples
    const doutores = await prisma.doutor.findMany({ take: 1 });
    console.log(`✅ Query de teste executada com sucesso!`);
    console.log(`   Total de doutores encontrados: ${await prisma.doutor.count()}`);
    
  } catch (error: any) {
    console.error('❌ Erro ao conectar com o banco de dados:');
    console.error('   Código:', error.code);
    console.error('   Mensagem:', error.message);
    
    if (error.code === 'P1000') {
      console.error('\n💡 Possíveis soluções:');
      console.error('   1. Verifique se o PostgreSQL está rodando');
      console.error('   2. Verifique as credenciais no arquivo .env');
      console.error('   3. Verifique se o banco de dados "simpatia" existe');
      console.error('   4. Tente criar o banco: CREATE DATABASE simpatia;');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();

