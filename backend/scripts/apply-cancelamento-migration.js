const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Aplicando migration de cancelamento...');
    
    await prisma.$executeRaw`
      ALTER TABLE "Agendamento" 
      ADD COLUMN IF NOT EXISTS "motivoCancelamento" TEXT,
      ADD COLUMN IF NOT EXISTS "canceladoPor" INTEGER,
      ADD COLUMN IF NOT EXISTS "canceladoEm" TIMESTAMP(3);
    `;
    
    console.log('Migration aplicada com sucesso!');
  } catch (error) {
    console.error('Erro ao aplicar migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

