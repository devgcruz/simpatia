-- AlterTable: Tornar principioAtivo obrigatório e adicionar novos campos
-- Primeiro, atualizar registros existentes que têm principioAtivo NULL
UPDATE "AlergiaMedicamento" 
SET "principioAtivo" = "nomeMedicamento" 
WHERE "principioAtivo" IS NULL OR "principioAtivo" = '';

-- Adicionar novos campos (opcionais)
ALTER TABLE "AlergiaMedicamento" 
ADD COLUMN IF NOT EXISTS "classeQuimica" TEXT,
ADD COLUMN IF NOT EXISTS "excipientes" TEXT;

-- Tornar principioAtivo obrigatório
ALTER TABLE "AlergiaMedicamento" 
ALTER COLUMN "principioAtivo" SET NOT NULL;

-- Criar índice em principioAtivo para melhorar performance das verificações
CREATE INDEX IF NOT EXISTS "AlergiaMedicamento_principioAtivo_idx" ON "AlergiaMedicamento"("principioAtivo");

