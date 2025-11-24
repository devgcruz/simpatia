-- AlterTable
ALTER TABLE "Medicamento" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Medicamento_deletedAt_idx" ON "Medicamento"("deletedAt");

