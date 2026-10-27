-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('order', 'bonus');

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "order_id" TEXT,
    "history_id" BIGINT,
    "bonus_tx_id" BIGINT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_history_id_key" ON "notifications"("history_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_bonus_tx_id_key" ON "notifications"("bonus_tx_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_id_idx" ON "notifications"("user_id", "id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "order_status_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_bonus_tx_id_fkey" FOREIGN KEY ("bonus_tx_id") REFERENCES "bonus_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ниже - то, чего Prisma не описывает: частичный индекс, CHECK и триггеры

-- счетчик непрочитанных: только непрочитанные строки пользователя
CREATE INDEX "notifications_unread_idx" ON "notifications" ("user_id") WHERE "read_at" IS NULL;

-- источник ровно один: уведомление о заказе - по строке истории статусов, о бонусах - по строке истории бонусов
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_source" CHECK (
  ("type" = 'order' AND "history_id" IS NOT NULL AND "bonus_tx_id" IS NULL AND "order_id" IS NOT NULL)
  OR ("type" = 'bonus' AND "bonus_tx_id" IS NOT NULL AND "history_id" IS NULL)
);

-- Уведомление на каждую смену статуса заказа: строка истории пишется триггером при любом переходе (сервис, воркер,
-- платежка, ручной SQL) - отсюда уведомление в той же транзакции. Создание заказа (from_status пустой) - не смена статуса
CREATE FUNCTION "notify_order_status"() RETURNS trigger AS $$
BEGIN
  IF NEW."from_status" IS NOT NULL THEN
    INSERT INTO "notifications" ("user_id", "type", "order_id", "history_id", "created_at")
    SELECT o."user_id", 'order', NEW."order_id", NEW."id", NEW."created_at" FROM "orders" o WHERE o."id" = NEW."order_id"
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "order_status_history_notify"
  AFTER INSERT ON "order_status_history"
  FOR EACH ROW EXECUTE FUNCTION "notify_order_status"();

-- Уведомление на каждое движение бонусов: регистрация, оплата заказа, возврат, кэшбэк
CREATE FUNCTION "notify_bonus"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "notifications" ("user_id", "type", "order_id", "bonus_tx_id", "created_at")
  VALUES (NEW."user_id", 'bonus', NEW."order_id", NEW."id", NEW."created_at")
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bonus_transactions_notify"
  AFTER INSERT ON "bonus_transactions"
  FOR EACH ROW EXECUTE FUNCTION "notify_bonus"();
