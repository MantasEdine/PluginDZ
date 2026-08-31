-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "stock_released" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "visits" (
    "id" SERIAL NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visits_created_at_idx" ON "visits"("created_at");

-- CreateIndex
CREATE INDEX "visits_visitor_id_idx" ON "visits"("visitor_id");

-- CreateIndex
CREATE INDEX "visits_source_idx" ON "visits"("source");

-- Backfill : les commandes déjà annulées ont déjà rendu leur stock.
UPDATE "orders" SET "stock_released" = true WHERE "status" = 'annule';
