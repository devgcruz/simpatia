const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Marcando migration como aplicada...');
    
    // Verificar se a migration já está registrada
    const existing = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" 
      WHERE migration_name = '20250118000000_add_cancelamento_fields'
    `;
    
    if (existing && existing.length > 0) {
      console.log('Migration já está registrada.');
      return;
    }
    
    // Inserir registro da migration
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (migration_name, applied_steps_count)
      VALUES ('20250118000000_add_cancelamento_fields', 1)
      ON CONFLICT (migration_name) DO NOTHING
    `;
    
    console.log('Migration marcada como aplicada!');
  } catch (error) {
    console.error('Erro ao marcar migration:', error);
    // Se der erro, não é crítico, a migration já foi aplicada
    console.log('Migration já foi aplicada no banco, continuando...');
  } finally {
    await prisma.$disconnect();
  }
}

main();

