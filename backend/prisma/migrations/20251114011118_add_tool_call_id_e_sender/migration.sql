-- AlterEnum
ALTER TYPE "SenderType" ADD VALUE 'TOOL';

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "tool_call_id" TEXT;
