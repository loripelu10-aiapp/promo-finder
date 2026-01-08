import { Prisma, Product, ProductCategory, ProductSource } from '@prisma/client';
import { prisma } from './client';

// ============================================
// TYPE DEFINITIONS & INTERFACES
// ============================================

export interface FilterOptions {
  category?: ProductCategory;
  brand?: string;
  minDiscount?: number;
  maxPrice?: number;
  source?: ProductSource;
  limit?: number;
  offset?: number;
  minConfidence?: number;
}

export interface ProductInput {
  name: string;
  brand: string;
  category: ProductCategory;
  source: ProductSource;
  originalPrice: number;
  salePrice: number;
  discountPercentage: number;
  productUrl: string;
  imageUrl?: string;
  isNew?: boolean;
  expiresAt?: Date;
  attributes?: Prisma.JsonValue;
  description?: string;
}

export interface ProductWithImages extends Product {
  images?: Array<{
    id: string;
    imageUrl: string;
    isPrimary: boolean;
    imageStatus: string;
  }>;
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Find active deals with filtering
 * Optimized for <50ms query time using indexed columns
 */
export async function findActiveDeals(
  filters: FilterOptions = {}
): Promise<ProductWithImages[]> {
  const {
    category,
    brand,
    minDiscount = 0,
    maxPrice,
    source,
    limit = 50,
    offset = 0,
    minConfidence = 85,
  } = filters;

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    confidenceScore: { gte: minConfidence },
    discountPercentage: { gte: minDiscount },
    ...(category && { category }),
    ...(brand && { brand: { equals: brand, mode: 'insensitive' } }),
    ...(maxPrice && { salePrice: { lte: maxPrice } }),
    ...(source && { source }),
    OR: [
      { expiresAt: { gt: new Date() } },
      { expiresAt: null },
    ],
  };

  const products = await prisma.product.findMany({
    where,
    include: {
      images: {
        where: { imageStatus: 'validated' },
        orderBy: { isPrimary: 'desc' },
        take: 1,
      },
    },
    orderBy: [
      { popularityScore: 'desc' },
      { discountPercentage: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
    skip: offset,
  });

  return products;
}

/**
 * Find product by ID
 * Includes all related data
 */
export async function findById(id: string): Promise<ProductWithImages | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: { isPrimary: 'desc' },
      },
      translations: true,
      verificationHistory: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  return product;
}

/**
 * Update confidence score for a product
 * Creates verification history entry
 */
export async function updateConfidenceScore(
  id: string,
  newScore: number,
  verificationType: string = 'manual',
  metadata?: Prisma.JsonValue
): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { confidenceScore: true },
  });

  if (!product) {
    throw new Error(`Product with ID ${id} not found`);
  }

  const previousConfidence = product.confidenceScore;

  // Update product and create verification history in a transaction
  await prisma.$transaction([
    prisma.product.update({
      where: { id },
      data: {
        confidenceScore: newScore,
        lastVerifiedAt: new Date(),
        isActive: newScore >= 50, // Auto-quarantine if confidence drops below 50%
      },
    }),
    prisma.verificationHistory.create({
      data: {
        productId: id,
        verificationType,
        status: newScore >= 85 ? 'success' : newScore >= 50 ? 'pending' : 'failed',
        previousConfidence,
        newConfidence: newScore,
        metadata,
      },
    }),
  ]);
}

/**
 * Bulk insert products
 * Optimized for batch operations with transactions
 */
export async function bulkInsertProducts(
  products: ProductInput[]
): Promise<{ count: number; ids: string[] }> {
  if (products.length === 0) {
    return { count: 0, ids: [] };
  }

  // Use createMany for better performance
  const result = await prisma.product.createMany({
    data: products.map((product) => ({
      ...product,
      confidenceScore: 70, // Default confidence for API data
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    skipDuplicates: true,
  });

  // Get the IDs of created products
  // Note: createMany doesn't return IDs, so we query them
  const createdProducts = await prisma.product.findMany({
    where: {
      productUrl: { in: products.map((p) => p.productUrl) },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: products.length,
  });

  return {
    count: result.count,
    ids: createdProducts.map((p) => p.id),
  };
}

/**
 * Get top deals by category
 * Uses optimized sorting for performance
 */
export async function getTopDealsByCategory(
  category: ProductCategory,
  limit: number = 10
): Promise<Product[]> {
  return prisma.product.findMany({
    where: {
      category,
      isActive: true,
      confidenceScore: { gte: 85 },
    },
    orderBy: [
      { discountPercentage: 'desc' },
      { popularityScore: 'desc' },
    ],
    take: limit,
  });
}

/**
 * Increment view count and update popularity score
 */
export async function recordInteraction(
  productId: string,
  interactionType: 'view' | 'click' | 'share' | 'favorite',
  metadata?: {
    sessionId?: string;
    userAgent?: string;
    country?: string;
    language?: string;
  }
): Promise<void> {
  await prisma.$transaction([
    // Create interaction record
    prisma.userInteraction.create({
      data: {
        productId,
        interactionType,
        sessionId: metadata?.sessionId,
        userAgent: metadata?.userAgent,
        country: metadata?.country,
        language: metadata?.language,
      },
    }),
    // Update product counters
    prisma.product.update({
      where: { id: productId },
      data: {
        viewCount: { increment: interactionType === 'view' ? 1 : 0 },
        clickCount: { increment: interactionType === 'click' ? 1 : 0 },
        // Simple popularity score: views + (clicks * 3) + (shares * 5) + (favorites * 10)
        popularityScore: {
          increment:
            interactionType === 'view'
              ? 1
              : interactionType === 'click'
              ? 3
              : interactionType === 'share'
              ? 5
              : 10,
        },
      },
    }),
  ]);
}

/**
 * Find products that need verification
 * Returns products that haven't been verified recently
 */
export async function findProductsNeedingVerification(
  hoursOld: number = 24,
  limit: number = 100
): Promise<Product[]> {
  const threshold = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

  return prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { lastVerifiedAt: null },
        { lastVerifiedAt: { lt: threshold } },
      ],
    },
    orderBy: [
      { popularityScore: 'desc' }, // Verify popular products first
      { createdAt: 'asc' },
    ],
    take: limit,
  });
}

/**
 * Get product statistics by source
 */
export async function getStatsBySource(): Promise<
  Array<{
    source: ProductSource;
    total: number;
    active: number;
    avgConfidence: number;
    avgDiscount: number;
  }>
> {
  const stats = await prisma.product.groupBy({
    by: ['source'],
    _count: { id: true },
    _avg: {
      confidenceScore: true,
      discountPercentage: true,
    },
    where: {
      isActive: true,
    },
  });

  return stats.map((stat) => ({
    source: stat.source,
    total: stat._count.id,
    active: stat._count.id,
    avgConfidence: Math.round(stat._avg.confidenceScore || 0),
    avgDiscount: Math.round(stat._avg.discountPercentage || 0),
  }));
}

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================

export const ProductQuery = {
  findActiveDeals,
  findById,
  updateConfidenceScore,
  bulkInsertProducts,
  getTopDealsByCategory,
  recordInteraction,
  findProductsNeedingVerification,
  getStatsBySource,
};

export default ProductQuery;
