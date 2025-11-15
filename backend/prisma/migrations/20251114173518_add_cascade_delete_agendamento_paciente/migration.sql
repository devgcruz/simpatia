-- DropForeignKey
ALTER TABLE "public"."Agendamento" DROP CONSTRAINT "Agendamento_pacienteId_fkey";

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
