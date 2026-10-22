-- Retire removed catalog entries without breaking historical quote references.
ALTER TABLE "product_categories" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "addons" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
