-- CreateTable
CREATE TABLE "PausaExcecao" (
    "id" SERIAL NOT NULL,
    "data" DATE NOT NULL,
    "pausaInicio" TEXT NOT NULL,
    "pausaFim" TEXT NOT NULL,
    "clinicaId" INTEGER,
    "doutorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PausaExcecao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PausaExcecao_clinicaId_data_idx" ON "PausaExcecao"("clinicaId", "data");

-- CreateIndex
CREATE INDEX "PausaExcecao_doutorId_data_idx" ON "PausaExcecao"("doutorId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "PausaExcecao_data_clinicaId_doutorId_key" ON "PausaExcecao"("data", "clinicaId", "doutorId");

-- AddForeignKey
ALTER TABLE "PausaExcecao" ADD CONSTRAINT "PausaExcecao_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PausaExcecao" ADD CONSTRAINT "PausaExcecao_doutorId_fkey" FOREIGN KEY ("doutorId") REFERENCES "Doutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
