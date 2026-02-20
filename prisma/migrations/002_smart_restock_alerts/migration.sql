-- Add stock tracking fields to products (tracked via Firestore, but we need Prisma types)
-- Product Daily Metrics table for per-product daily aggregates
CREATE TABLE IF NOT EXISTS "product_daily_metrics" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "detail_opens" INTEGER NOT NULL DEFAULT 0,
    "add_to_carts" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "units_sold" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_daily_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_daily_metrics_product_id_date_key" ON "product_daily_metrics"("product_id", "date");
CREATE INDEX "product_daily_metrics_business_id_date_idx" ON "product_daily_metrics"("business_id", "date");
CREATE INDEX "product_daily_metrics_product_id_date_idx" ON "product_daily_metrics"("product_id", "date");

-- Product Insight Flags table for generated alerts
CREATE TABLE IF NOT EXISTS "product_insight_flags" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "flag_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "product_insight_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_insight_flags_business_id_idx" ON "product_insight_flags"("business_id");
CREATE INDEX "product_insight_flags_product_id_idx" ON "product_insight_flags"("product_id");
CREATE INDEX "product_insight_flags_business_id_resolved_idx" ON "product_insight_flags"("business_id", "resolved_at");
CREATE INDEX "product_insight_flags_flag_type_idx" ON "product_insight_flags"("flag_type");

-- Restock alert config per business
CREATE TABLE IF NOT EXISTS "restock_alert_config" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "growth_threshold_pct" INTEGER NOT NULL DEFAULT 60,
    "spike_threshold_pct" INTEGER NOT NULL DEFAULT 120,
    "stockout_warn_days" INTEGER NOT NULL DEFAULT 7,
    "stockout_urgent_days" INTEGER NOT NULL DEFAULT 3,
    "alert_cooldown_hours" INTEGER NOT NULL DEFAULT 48,
    "email_alerts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restock_alert_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "restock_alert_config_business_id_key" ON "restock_alert_config"("business_id");
