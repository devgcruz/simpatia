-- AlterTable
ALTER TABLE "Paciente" ADD COLUMN     "doutorId" INTEGER;

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_doutorId_fkey" FOREIGN KEY ("doutorId") REFERENCES "Doutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
