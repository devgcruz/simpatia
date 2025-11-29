-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN "isEncaixe" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agendamento" ADD COLUMN "confirmadoPorMedico" BOOLEAN NOT NULL DEFAULT false;
