-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "motivoCancelamento" TEXT,
ADD COLUMN     "canceladoPor" INTEGER,
ADD COLUMN     "canceladoEm" TIMESTAMP(3);

