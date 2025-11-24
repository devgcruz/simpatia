-- AlterTable: Remover deletedAt e adicionar ativo
ALTER TABLE "Medicamento" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN NOT NULL DEFAULT true;

-- DropIndex
DROP INDEX IF EXISTS "Medicamento_deletedAt_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Medicamento_ativo_idx" ON "Medicamento"("ativo");

