-- Add ativo flag to all core entities for soft delete support

ALTER TABLE "Clinica"
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Doutor"
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Horario"
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Paciente"
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Servico"
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Agendamento"
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Indisponibilidade"
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "PausaExcecao"
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- Adjust unique constraints to consider the ativo flag

DROP INDEX IF EXISTS "public"."Paciente_telefone_clinicaId_key";
CREATE UNIQUE INDEX "Paciente_telefone_clinicaId_ativo_key"
ON "Paciente"("telefone", "clinicaId", "ativo");

DROP INDEX IF EXISTS "public"."PausaExcecao_data_clinicaId_doutorId_key";
CREATE UNIQUE INDEX "PausaExcecao_data_clinicaId_doutorId_ativo_key"
ON "PausaExcecao"("data", "clinicaId", "doutorId", "ativo");

