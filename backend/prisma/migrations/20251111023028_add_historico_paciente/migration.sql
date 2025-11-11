-- CreateTable
CREATE TABLE "HistoricoPaciente" (
    "id" SERIAL NOT NULL,
    "descricao" TEXT NOT NULL,
    "realizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pacienteId" INTEGER NOT NULL,
    "agendamentoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoPaciente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoPaciente_pacienteId_realizadoEm_idx" ON "HistoricoPaciente"("pacienteId", "realizadoEm");

-- AddForeignKey
ALTER TABLE "HistoricoPaciente" ADD CONSTRAINT "HistoricoPaciente_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPaciente" ADD CONSTRAINT "HistoricoPaciente_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
