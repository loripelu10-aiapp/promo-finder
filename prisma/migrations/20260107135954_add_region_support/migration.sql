-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('amazon', 'nike', 'zara', 'adidas', 'hm', 'uniqlo', 'mango', 'asos', 'pullbear', 'bershka', 'stradivarius', 'manual');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('shoes', 'clothing', 'accessories', 'bags', 'jewelry', 'watches', 'sunglasses', 'other');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'success', 'failed', 'quarantined');

-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('pending', 'validated', 'broken', 'invalid');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('US', 'EU', 'UK', 'IT', 'FR', 'DE', 'ES', 'GLOBAL');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "source" "ProductSource" NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "discountPercentage" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "availableRegions" TEXT[] DEFAULT ARRAY['EU']::TEXT[],
    "productUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "confidenceScore" INTEGER NOT NULL DEFAULT 70,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "attributes" JSONB,
    "description" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageStatus" "ImageStatus" NOT NULL DEFAULT 'pending',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "altText" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "validatedWithClaude" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isAutoTranslated" BOOLEAN NOT NULL DEFAULT false,
    "translatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_history" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "httpStatus" INTEGER,
    "responseTime" INTEGER,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "previousConfidence" INTEGER NOT NULL,
    "newConfidence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestParams" JSONB,
    "responseStatus" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 1,
    "estimatedCost" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interactions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "country" TEXT,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_isActive_category_discountPercentage_confidenceSco_idx" ON "products"("isActive", "category", "discountPercentage", "confidenceScore");

-- CreateIndex
CREATE INDEX "products_source_isActive_idx" ON "products"("source", "isActive");

-- CreateIndex
CREATE INDEX "products_brand_category_idx" ON "products"("brand", "category");

-- CreateIndex
CREATE INDEX "products_popularityScore_idx" ON "products"("popularityScore");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt");

-- CreateIndex
CREATE INDEX "products_expiresAt_idx" ON "products"("expiresAt");

-- CreateIndex
CREATE INDEX "products_availableRegions_idx" ON "products"("availableRegions");

-- CreateIndex
CREATE INDEX "product_images_productId_idx" ON "product_images"("productId");

-- CreateIndex
CREATE INDEX "product_images_imageStatus_idx" ON "product_images"("imageStatus");

-- CreateIndex
CREATE INDEX "translations_language_idx" ON "translations"("language");

-- CreateIndex
CREATE UNIQUE INDEX "translations_productId_language_key" ON "translations"("productId", "language");

-- CreateIndex
CREATE INDEX "verification_history_productId_createdAt_idx" ON "verification_history"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "verification_history_verificationType_idx" ON "verification_history"("verificationType");

-- CreateIndex
CREATE INDEX "verification_history_status_idx" ON "verification_history"("status");

-- CreateIndex
CREATE INDEX "api_logs_provider_createdAt_idx" ON "api_logs"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "api_logs_success_idx" ON "api_logs"("success");

-- CreateIndex
CREATE INDEX "user_interactions_productId_createdAt_idx" ON "user_interactions"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "user_interactions_interactionType_idx" ON "user_interactions"("interactionType");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_history" ADD CONSTRAINT "verification_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
