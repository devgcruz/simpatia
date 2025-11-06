-- Renomear tabela Dentista para Doutor
ALTER TABLE "Dentista" RENAME TO "Doutor";

-- Renomear foreign key constraint na tabela Horario
ALTER TABLE "Horario" RENAME CONSTRAINT "Horario_dentistaId_fkey" TO "Horario_doutorId_fkey";
ALTER TABLE "Horario" RENAME COLUMN "dentistaId" TO "doutorId";

-- Renomear foreign key constraint na tabela Agendamento
ALTER TABLE "Agendamento" RENAME CONSTRAINT "Agendamento_dentistaId_fkey" TO "Agendamento_doutorId_fkey";
ALTER TABLE "Agendamento" RENAME COLUMN "dentistaId" TO "doutorId";

-- Renomear índice único (se existir)
ALTER INDEX IF EXISTS "Dentista_email_key" RENAME TO "Doutor_email_key";
