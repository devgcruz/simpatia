-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('BOT', 'HANDOFF', 'CLOSED');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('IA', 'PACIENTE', 'DOUTOR');

-- AlterTable
ALTER TABLE "Paciente" ADD COLUMN     "chatStatus" "ChatStatus" NOT NULL DEFAULT 'BOT';

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pacienteId" INTEGER NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_pacienteId_createdAt_idx" ON "ChatMessage"("pacienteId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
