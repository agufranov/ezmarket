-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('created', 'pending', 'paid', 'processing', 'completed', 'failed', 'canceled', 'expired');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "steam_login" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "pay_amount" INTEGER NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'created',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" BIGSERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_payment_id_key" ON "orders"("payment_id");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_user_id_idempotency_key_key" ON "orders"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_id_idx" ON "order_status_history"("order_id", "id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Суммы - целые положительные в минимальных единицах; платить деньгами не больше суммы заказа
ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_pay_amount_range" CHECK ("pay_amount" >= 0 AND "pay_amount" <= "amount");
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_known" CHECK ("currency" IN ('RUB', 'USD', 'KZT'));

-- Фоновая задача истечения ищет только неоплаченные заказы
CREATE INDEX "orders_unpaid_expires_at_idx" ON "orders"("expires_at") WHERE "status" IN ('created', 'pending');

-- Переходы статусов - только по правилам, даже если ошибется код приложения:
--   created -> pending | canceled | expired
--   pending -> paid | canceled | expired
--   paid -> processing
--   processing -> completed | failed
-- completed, failed, canceled, expired - конечные
CREATE FUNCTION "order_status_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = OLD."status" THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD."status" = 'created' AND NEW."status" IN ('pending', 'canceled', 'expired')) OR
    (OLD."status" = 'pending' AND NEW."status" IN ('paid', 'canceled', 'expired')) OR
    (OLD."status" = 'paid' AND NEW."status" = 'processing') OR
    (OLD."status" = 'processing' AND NEW."status" IN ('completed', 'failed'))
  ) THEN
    RAISE EXCEPTION 'order %: transition % -> % is not allowed', OLD."id", OLD."status", NEW."status"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "orders_status_guard"
  BEFORE UPDATE OF "status" ON "orders"
  FOR EACH ROW EXECUTE FUNCTION "order_status_guard"();

-- История пишется в той же транзакции, что и смена статуса: разойтись с заказом она не может.
-- Причину приложение передает через set_config('ezmarket.status_reason', ..., true) - она живет до конца транзакции
CREATE FUNCTION "order_status_log"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."status" IS DISTINCT FROM OLD."status" THEN
    INSERT INTO "order_status_history" ("order_id", "from_status", "to_status", "reason")
    VALUES (
      NEW."id",
      CASE WHEN TG_OP = 'UPDATE' THEN OLD."status" END,
      NEW."status",
      NULLIF(current_setting('ezmarket.status_reason', true), '')
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "orders_status_log"
  AFTER INSERT OR UPDATE OF "status" ON "orders"
  FOR EACH ROW EXECUTE FUNCTION "order_status_log"();
