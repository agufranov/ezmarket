-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_provider" TEXT,
ADD COLUMN     "payment_url" TEXT;

-- CreateIndex
CREATE INDEX "orders_payment_provider_status_idx" ON "orders"("payment_provider", "status");

