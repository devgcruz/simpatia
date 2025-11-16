-- CreateTable
CREATE TABLE "Indisponibilidade" (
    "id" SERIAL NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "doutorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Indisponibilidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Indisponibilidade_doutorId_inicio_fim_idx" ON "Indisponibilidade"("doutorId", "inicio", "fim");

-- AddForeignKey
ALTER TABLE "Indisponibilidade" ADD CONSTRAINT "Indisponibilidade_doutorId_fkey" FOREIGN KEY ("doutorId") REFERENCES "Doutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
