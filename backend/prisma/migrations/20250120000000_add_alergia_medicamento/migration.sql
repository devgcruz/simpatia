-- CreateTable
CREATE TABLE "AlergiaMedicamento" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "medicamentoId" INTEGER,
    "nomeMedicamento" TEXT NOT NULL,
    "principioAtivo" TEXT,
    "observacoes" TEXT,
    "cadastradoPor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlergiaMedicamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlergiaMedicamento_pacienteId_idx" ON "AlergiaMedicamento"("pacienteId");

-- CreateIndex
CREATE INDEX "AlergiaMedicamento_medicamentoId_idx" ON "AlergiaMedicamento"("medicamentoId");

-- CreateIndex
CREATE INDEX "AlergiaMedicamento_nomeMedicamento_idx" ON "AlergiaMedicamento"("nomeMedicamento");

-- AddForeignKey
ALTER TABLE "AlergiaMedicamento" ADD CONSTRAINT "AlergiaMedicamento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlergiaMedicamento" ADD CONSTRAINT "AlergiaMedicamento_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

