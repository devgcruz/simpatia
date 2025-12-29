-- AlterTable: Adicionar campo publicKey para criptografia E2E no modelo Doutor
ALTER TABLE "Doutor" ADD COLUMN IF NOT EXISTS "publicKey" TEXT;

-- AlterTable: Adicionar campo publicKey para criptografia E2E no modelo Paciente
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "publicKey" TEXT;

