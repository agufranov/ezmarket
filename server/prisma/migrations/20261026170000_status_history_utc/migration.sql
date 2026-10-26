-- Время в истории статусов - в UTC, как во всех колонках, которые пишет Prisma.
-- Раньше бралось значение по умолчанию CURRENT_TIMESTAMP в часовом поясе сессии базы:
-- при поясе не UTC (локальная база на Windows) история уезжала на несколько часов.
CREATE OR REPLACE FUNCTION "order_status_log"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."status" IS DISTINCT FROM OLD."status" THEN
    INSERT INTO "order_status_history" ("order_id", "from_status", "to_status", "reason", "created_at")
    VALUES (
      NEW."id",
      CASE WHEN TG_OP = 'UPDATE' THEN OLD."status" END,
      NEW."status",
      NULLIF(current_setting('ezmarket.status_reason', true), ''),
      now() AT TIME ZONE 'UTC'
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
