-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "doutorId" INTEGER;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_doutorId_fkey" FOREIGN KEY ("doutorId") REFERENCES "Doutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
