-- CreateTable
CREATE TABLE "ProntuarioChatMessage" (
    "id" SERIAL NOT NULL,
    "agendamentoId" INTEGER NOT NULL,
    "sender" "SenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProntuarioChatMessage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProntuarioChatMessage"
ADD CONSTRAINT "ProntuarioChatMessage_agendamentoId_fkey"
FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ProntuarioChatMessage_agendamentoId_createdAt_idx"
ON "ProntuarioChatMessage"("agendamentoId", "createdAt");
