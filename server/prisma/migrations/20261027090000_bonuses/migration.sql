-- CreateEnum
CREATE TYPE "bonus_kind" AS ENUM ('signup', 'spend', 'refund', 'accrual');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "bonus_accrual" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bonus_spent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "bonus_transactions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "kind" "bonus_kind" NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonus_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bonus_transactions_user_id_id_idx" ON "bonus_transactions"("user_id", "id");

-- AddForeignKey
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Бонусы в заказе: 1 бонус = 1 ₽ (bonus_spent - в рублях, суммы - в копейках), не больше 30% суммы, только для рублей;
-- к оплате деньгами - сумма минус бонусы
ALTER TABLE "orders" ADD CONSTRAINT "orders_bonus_spent_range" CHECK ("bonus_spent" >= 0 AND "bonus_spent" * 1000 <= "amount" * 3);
ALTER TABLE "orders" ADD CONSTRAINT "orders_bonus_accrual_non_negative" CHECK ("bonus_accrual" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_bonus_rub_only" CHECK (("bonus_spent" = 0 AND "bonus_accrual" = 0) OR "currency" = 'RUB');
ALTER TABLE "orders" ADD CONSTRAINT "orders_pay_amount_formula" CHECK ("pay_amount" = "amount" - "bonus_spent" * 100);

-- История бонусов: знак по виду (списание - минус, остальное - плюс), баланс после операции не ниже нуля
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_delta_sign" CHECK ("delta" <> 0 AND (("kind" = 'spend') = ("delta" < 0)));
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_balance_non_negative" CHECK ("balance_after" >= 0);
-- по заказу - не больше одного списания, одного возврата и одного начисления; за регистрацию - один раз
CREATE UNIQUE INDEX "bonus_transactions_order_kind_key" ON "bonus_transactions"("order_id", "kind") WHERE "order_id" IS NOT NULL;
CREATE UNIQUE INDEX "bonus_transactions_signup_key" ON "bonus_transactions"("user_id") WHERE "kind" = 'signup';

-- Бонусы при смене статуса заказа - в той же транзакции, что и переход, через какой бы код он ни шел:
--   canceled | expired | failed - вернуть списанное; completed - начислить кэшбэк.
-- Уникальный индекс по (order_id, kind) делает обе операции однократными: повторный переход или повтор
-- события не вернет и не начислит второй раз (ON CONFLICT DO NOTHING - тогда баланс не трогаем)
CREATE FUNCTION "order_bonus_effects"() RETURNS trigger AS $$
DECLARE
  tx_kind "bonus_kind";
  tx_delta INTEGER;
  tx_id BIGINT;
  balance INTEGER;
BEGIN
  IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
    RETURN NULL;
  END IF;
  IF NEW."status" IN ('canceled', 'expired', 'failed') AND NEW."bonus_spent" > 0 THEN
    tx_kind := 'refund';
    tx_delta := NEW."bonus_spent";
  ELSIF NEW."status" = 'completed' AND NEW."bonus_accrual" > 0 THEN
    tx_kind := 'accrual';
    tx_delta := NEW."bonus_accrual";
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO "bonus_transactions" ("user_id", "order_id", "kind", "delta", "balance_after", "created_at")
  VALUES (NEW."user_id", NEW."id", tx_kind, tx_delta, 0, now() AT TIME ZONE 'UTC')
  ON CONFLICT DO NOTHING
  RETURNING "id" INTO tx_id;
  IF tx_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE "users" SET "bonus_balance" = "bonus_balance" + tx_delta WHERE "id" = NEW."user_id" RETURNING "bonus_balance" INTO balance;
  UPDATE "bonus_transactions" SET "balance_after" = balance WHERE "id" = tx_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "orders_bonus_effects"
  AFTER UPDATE OF "status" ON "orders"
  FOR EACH ROW EXECUTE FUNCTION "order_bonus_effects"();
