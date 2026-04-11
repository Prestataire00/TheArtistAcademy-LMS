-- AlterTable
ALTER TABLE "formations" ADD COLUMN     "trainer_id" TEXT;

-- CreateIndex
CREATE INDEX "formations_trainer_id_idx" ON "formations"("trainer_id");

-- AddForeignKey
ALTER TABLE "formations" ADD CONSTRAINT "formations_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
