/*
  Warnings:

  - A unique constraint covering the columns `[telefone,clinicaId]` on the table `Paciente` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clinicaId` to the `Doutor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clinicaId` to the `Paciente` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clinicaId` to the `Servico` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN');

-- DropIndex
DROP INDEX "public"."Paciente_telefone_key";

ALTER TABLE "Doutor"
ADD COLUMN     "clinicaId" INTEGER NOT NULL,
ADD COLUMN     "especialidade" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'DOUTOR';

-- AlterTable
ALTER TABLE "Paciente" ADD COLUMN     "clinicaId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "clinicaId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Clinica" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "endereco" TEXT,
    "telefone" TEXT,
    "whatsappToken" TEXT,
    "whatsappPhoneId" TEXT,
    "webhookUrlId" TEXT NOT NULL,
    "webhookVerifyToken" TEXT NOT NULL,

    CONSTRAINT "Clinica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clinica_cnpj_key" ON "Clinica"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Clinica_webhookUrlId_key" ON "Clinica"("webhookUrlId");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_telefone_clinicaId_key" ON "Paciente"("telefone", "clinicaId");

-- AddForeignKey
ALTER TABLE "Doutor" ADD CONSTRAINT "Doutor_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;
