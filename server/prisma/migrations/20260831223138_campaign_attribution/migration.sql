-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "utm_campaign" TEXT,
ADD COLUMN     "utm_medium" TEXT,
ADD COLUMN     "utm_source" TEXT;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "campaign" TEXT,
ADD COLUMN     "medium" TEXT NOT NULL DEFAULT 'none';

-- CreateIndex
CREATE INDEX "orders_utm_campaign_idx" ON "orders"("utm_campaign");

-- CreateIndex
CREATE INDEX "visits_campaign_idx" ON "visits"("campaign");
