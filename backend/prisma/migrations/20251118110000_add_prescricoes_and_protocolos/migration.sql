-- AlterTable
ALTER TABLE "HistoricoPaciente"
ADD COLUMN "protocolo" TEXT NOT NULL DEFAULT gen_random_uuid();

-- CreateIndex
CREATE UNIQUE INDEX "HistoricoPaciente_protocolo_key" ON "HistoricoPaciente"("protocolo");

-- CreateIndex
CREATE INDEX "HistoricoPaciente_protocolo_idx" ON "HistoricoPaciente"("protocolo");

-- CreateTable
CREATE TABLE "Prescricao" (
    "id" SERIAL NOT NULL,
    "protocolo" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "conteudo" TEXT NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "doutorId" INTEGER NOT NULL,
    "agendamentoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescricao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prescricao_protocolo_key" ON "Prescricao"("protocolo");

-- CreateIndex
CREATE INDEX "Prescricao_pacienteId_createdAt_idx" ON "Prescricao"("pacienteId", "createdAt");

-- CreateIndex
CREATE INDEX "Prescricao_protocolo_idx" ON "Prescricao"("protocolo");

-- AddForeignKey
ALTER TABLE "Prescricao" ADD CONSTRAINT "Prescricao_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescricao" ADD CONSTRAINT "Prescricao_doutorId_fkey" FOREIGN KEY ("doutorId") REFERENCES "Doutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescricao" ADD CONSTRAINT "Prescricao_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;


