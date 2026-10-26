-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "fulfil_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fulfil_claimed_at" TIMESTAMP(3);


-- Восстановление выполнения ищет только заказы в processing
CREATE INDEX "orders_processing_claim_idx" ON "orders"("fulfil_claimed_at") WHERE "status" = 'processing';
