-- CreateTable
CREATE TABLE "Medicamento" (
    "id" SERIAL NOT NULL,
    "tipoProduto" TEXT,
    "nomeProduto" TEXT NOT NULL,
    "dataFinalizacaoProcesso" TIMESTAMP(3),
    "categoriaRegulatoria" TEXT,
    "numeroRegistroProduto" TEXT,
    "dataVencimentoRegistro" TIMESTAMP(3),
    "numeroProcesso" TEXT,
    "classeTerapeutica" TEXT,
    "empresaDetentoraRegistro" TEXT,
    "situacaoRegistro" TEXT,
    "principioAtivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Medicamento_nomeProduto_idx" ON "Medicamento"("nomeProduto");

-- CreateIndex
CREATE INDEX "Medicamento_numeroRegistroProduto_idx" ON "Medicamento"("numeroRegistroProduto");

-- CreateIndex
CREATE INDEX "Medicamento_classeTerapeutica_idx" ON "Medicamento"("classeTerapeutica");

