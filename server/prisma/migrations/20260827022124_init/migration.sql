-- CreateExtension
-- Required before "staff_users" below because its "email" column uses CITEXT
-- (case-insensitive unique email). Prisma's postgresqlExtensions preview
-- feature is not enabled, so this is added by hand.
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abn" TEXT NOT NULL,
    "qbcc" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankBsb" TEXT NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "cardFeePercent" DECIMAL(5,2) NOT NULL,
    "gstRate" DECIMAL(4,3) NOT NULL DEFAULT 0.10,
    "depositRate" DECIMAL(4,3) NOT NULL DEFAULT 0.50,
    "nonStandardColourPrice" DECIMAL(10,2) NOT NULL DEFAULT 220.00,
    "validityDays" INTEGER NOT NULL DEFAULT 30,
    "warrantyUrl" TEXT NOT NULL,
    "careUrl" TEXT NOT NULL,
    "termsNote" TEXT NOT NULL,
    "termsContract" TEXT NOT NULL,
    "sizeDisclaimer" TEXT NOT NULL,
    "licensing" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricingAsAt" DATE,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "extraThresholdMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_cells" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "price" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesh_extras" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "underPrice" DECIMAL(10,2),
    "overPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesh_extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colours" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "additionalCharge" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colour_products" (
    "colourId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "colour_products_pkey" PRIMARY KEY ("colourId","productId")
);

-- CreateTable
CREATE TABLE "addons" (
    "id" TEXT NOT NULL,
    "section" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "priceOnRequest" BOOLEAN NOT NULL DEFAULT false,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Auth is not implemented yet (see docs/backend-handoff-zh.md §5.1). This table
-- exists now so "quotes"."createdBy" has somewhere to point once login lands;
-- "passwordHash" stays nullable and no rows are seeded until then.
CREATE TABLE "staff_users" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "quoteNo" TEXT NOT NULL,
    "quoteSuffix" TEXT,
    "quoteDate" DATE NOT NULL,
    "customerId" TEXT,
    "shipSameAsBill" BOOLEAN NOT NULL DEFAULT true,
    "shipName" TEXT,
    "shipPhone" TEXT,
    "shipAddress" TEXT,
    "colourId" TEXT,
    "customFrameColour" TEXT,
    "colourExtraOverride" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "gstEnabled" BOOLEAN NOT NULL DEFAULT true,
    "colourSurcharge" DECIMAL(10,2),
    "saleAmount" DECIMAL(10,2),
    "gstAmount" DECIMAL(10,2),
    "totalAmount" DECIMAL(10,2),
    "depositAmount" DECIMAL(10,2),
    "paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "validUntil" DATE,
    "issuedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "categoryId" TEXT,
    "addonId" TEXT,
    "description" TEXT NOT NULL,
    "room" TEXT,
    "note" TEXT,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "matchedWidthMm" INTEGER,
    "matchedHeightMm" INTEGER,
    "meshOption" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_key_key" ON "products"("key");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_productId_key_key" ON "product_categories"("productId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "price_cells_categoryId_widthMm_heightMm_key" ON "price_cells"("categoryId", "widthMm", "heightMm");

-- CreateIndex
CREATE UNIQUE INDEX "mesh_extras_categoryId_name_key" ON "mesh_extras"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "colours_name_key" ON "colours"("name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quoteNo_key" ON "quotes"("quoteNo");

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_cells" ADD CONSTRAINT "price_cells_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesh_extras" ADD CONSTRAINT "mesh_extras_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colour_products" ADD CONSTRAINT "colour_products_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "colours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colour_products" ADD CONSTRAINT "colour_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "colours"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "addons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateSequence
-- Server/database-owned quote numbering (docs/backend-handoff-zh.md §5.7). Prisma
-- has no native way to model a standalone sequence, so it is created here by hand.
-- Starting value matches the frontend's current client-side counter in
-- src/lib/quoteContext.tsx (localStorage key "smartquote-pro:quote-seq", last used
-- value 33020) so the first server-issued number continues on from it: 33021.
--
-- Usage (backend code, once quote-creation endpoints exist):
--   Call `SELECT nextval('quote_number_seq')` inside the SAME transaction that
--   inserts the new "quotes" row, then zero-pad it for storage/display:
--     SELECT LPAD(nextval('quote_number_seq')::text, 8, '0');  -- e.g. '00033021'
--   Store the padded value in "quotes"."quoteNo". Never call nextval() outside of
--   a transaction that commits the quote row -- a rolled-back transaction still
--   consumes the sequence value (by design: allocated numbers must never be
--   reused, so a failed insert should burn a number rather than risk a collision).
--   The free-text "quoteSuffix" column (e.g. '-SS', '-IG', '-DG') stays a separate
--   field appended only for display, exactly as today's displayQuoteNo.ts does.
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START WITH 33021;
