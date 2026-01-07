# API Integration Guide

Complete guide for integrating and using the PromoFinder API layer to fetch 1000+ fashion deals from premium APIs.

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [API Providers](#api-providers)
4. [Configuration](#configuration)
5. [Usage](#usage)
6. [Rate Limiting](#rate-limiting)
7. [Caching](#caching)
8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The API integration layer provides a unified interface to fetch fashion products from multiple premium APIs:

- **RapidAPI** - Real-Time Product Search API (Amazon, eBay, Walmart, etc.)
- **Rainforest API** - Amazon Product Data API

### Key Features

- Unified API aggregation across multiple providers
- Intelligent caching with Redis (6-hour TTL)
- Rate limiting to prevent quota exhaustion
- Automatic retry with exponential backoff
- Data validation and confidence scoring (70-99%)
- Pre-configured queries for 20+ top fashion brands
- Category and deal-based search

---

## Setup

### 1. Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Redis server (local or Upstash)
- API keys for RapidAPI and Rainforest API

### 2. Get API Keys

#### RapidAPI

1. Sign up at [RapidAPI](https://rapidapi.com)
2. Subscribe to [Real-Time Product Search API](https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-product-search)
3. Free tier: 100 requests/month
4. Paid tier: Starting at $0.01-0.05 per request
5. Copy your API key

#### Rainforest API

1. Sign up at [Rainforest API](https://www.rainforestapi.com)
2. Get your API key from the dashboard
3. Free tier: 100 requests/month
4. Paid tier: Starting at $0.01 per request

### 3. Environment Configuration

Create a `.env` file in `/backend` directory:

```bash
# Copy from .env.example
cp .env.example .env
```

Update the following variables:

```bash
# RapidAPI Configuration
RAPIDAPI_KEY=your_actual_rapidapi_key_here

# Rainforest API Configuration
RAINFOREST_API_KEY=your_actual_rainforest_key_here

# API Configuration
API_RATE_LIMIT=100          # Requests per day
API_CACHE_TTL=21600         # Cache TTL in seconds (6 hours)
API_RETRY_ATTEMPTS=3        # Max retry attempts
API_TIMEOUT=5000            # Request timeout in ms

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/promofinder
```

### 4. Install Dependencies

```bash
cd backend
npm install
```

### 5. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed database
npm run db:seed
```

---

## API Providers

### RapidAPI - Real-Time Product Search

**Best for:** Multi-marketplace product search (Amazon, eBay, Walmart)

**Features:**
- Search across multiple marketplaces
- Real-time pricing and availability
- Product images and descriptions
- Price history and comparison

**Limitations:**
- Free tier: 100 requests/month
- Response time: 1-3 seconds
- Rate limits apply

**Example Response:**
```typescript
{
  product_id: "B08N5WRWNW",
  product_title: "Nike Air Max 270 Men's Shoes",
  product_price: "$89.99",
  product_original_price: "$150.00",
  product_discount: "40%",
  product_url: "https://www.amazon.com/...",
  product_photo: "https://m.media-amazon.com/...",
  brand: "Nike",
  category: "Shoes"
}
```

### Rainforest API - Amazon Product Data

**Best for:** Detailed Amazon product information

**Features:**
- Comprehensive product details
- Customer reviews and ratings
- Product images (multiple angles)
- ASIN-based product lookup
- Category bestsellers

**Limitations:**
- Free tier: 100 requests/month
- Amazon-only data
- Response time: 2-4 seconds

**Example Response:**
```typescript
{
  asin: "B08N5WRWNW",
  title: "Nike Air Max 270 Men's Shoes",
  link: "https://www.amazon.com/...",
  image: "https://m.media-amazon.com/...",
  price: {
    value: 89.99,
    currency: "USD"
  },
  price_upper: {
    value: 150.00,
    currency: "USD"
  },
  brand: "Nike",
  rating: 4.5,
  ratings_total: 1250
}
```

---

## Configuration

### Rate Limiting

Configure rate limits to stay within free tier quotas:

```typescript
import { createRateLimiter } from './services/api/rate-limiter';

const rateLimiter = createRateLimiter([
  {
    provider: 'rapidapi',
    maxRequests: 100,    // Per day
    windowMs: 86400000,  // 24 hours
    retryAfterMs: 3600000 // 1 hour
  },
  {
    provider: 'rainforest',
    maxRequests: 100,
    windowMs: 86400000,
    retryAfterMs: 3600000
  }
]);
```

### Caching

Configure Redis caching to minimize API calls:

```typescript
import { createCache } from './services/api/cache';

const cache = createCache({
  ttl: 21600,  // 6 hours in seconds
  redisUrl: process.env.REDIS_URL
});
```

### Retry Strategy

Configure retry behavior for failed requests:

```typescript
const retryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  strategy: 'exponential' as const,
  retryableErrors: [408, 429, 500, 502, 503, 504]
};
```

---

## Usage

### Basic Product Search

```typescript
import { getAggregator } from './services/api/aggregator';

const aggregator = getAggregator();

// Search across all providers
const result = await aggregator.searchProducts('Nike shoes', {
  maxPrice: 150,
  limit: 20
});

console.log(`Found ${result.totalResults} products`);
console.log(`Sources: ${result.sources.map(s => s.provider).join(', ')}`);
```

### Search by Brand

```typescript
import { getBrandQuery } from './services/api/queries/fashion-brands';

// Get pre-configured brand query
const nikeQuery = getBrandQuery('Nike');

// Search for Nike products
const result = await aggregator.searchByBrand(nikeQuery);

console.log(`Found ${result.products.length} Nike products`);
```

### Search by Category

```typescript
import { ProductCategory } from '@prisma/client';
import { getCategoryQuery } from './services/api/queries/categories';

// Get pre-configured category query
const shoesQuery = getCategoryQuery(ProductCategory.shoes);

// Search for shoes
const result = await aggregator.searchByCategory(shoesQuery);

console.log(`Found ${result.products.length} shoes`);
```

### Search for Deals

```typescript
import { getDealQuery, DealType } from './services/api/queries/deals';

// Get flash sale deals (50%+ discount)
const flashSaleQuery = getDealQuery(DealType.FLASH_SALE);

// Search for flash sales
const result = await aggregator.searchDeals(flashSaleQuery);

console.log(`Found ${result.products.length} flash sale items`);
```

### Fetch Multiple Brands

```typescript
// Fetch products from multiple brands
const brands = ['Nike', 'Adidas', 'Puma'];

const result = await aggregator.fetchMultipleBrands(brands, {
  minDiscount: 30,
  maxPrice: 200,
  limit: 100
});

console.log(`Fetched ${result.totalResults} products from ${brands.length} brands`);
```

### Save to Database

```typescript
// Fetch and save to database
const products = result.products;

const saveResult = await aggregator.saveToDatabase(products);

console.log(`Saved ${saveResult.count} products to database`);
console.log(`Product IDs:`, saveResult.ids);
```

---

## Rate Limiting

### Check Rate Limit Status

```typescript
import { getRateLimiter } from './services/api/rate-limiter';

const rateLimiter = getRateLimiter();

// Check rate limit for a provider
const info = await rateLimiter.getRateLimitInfo('rapidapi');

console.log(`Requests today: ${info.requestsToday}`);
console.log(`Requests remaining: ${info.requestsRemaining}`);
console.log(`Resets at: ${info.resetsAt}`);
console.log(`Is limited: ${info.isLimited}`);
```

### Handle Rate Limits

The system automatically handles rate limits:

```typescript
try {
  const result = await aggregator.searchProducts('fashion');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limit exceeded. Retry after ${error.retryAfter}ms`);
    // Fallback to cached data or alternative provider
  }
}
```

### Reset Rate Limits (Admin Only)

```typescript
// Reset rate limit for a provider
await rateLimiter.resetLimit('rapidapi');

// Reset all rate limits
await rateLimiter.resetAllLimits();
```

---

## Caching

### Cache Strategy

- **TTL:** 6 hours (21600 seconds)
- **Storage:** Redis + in-memory fallback
- **Key Format:** `api:{provider}:{hash(params)}`
- **Hit Rate Target:** >80%

### Cache Operations

```typescript
import { getCache } from './services/api/cache';

const cache = getCache();

// Get cache stats
const stats = await cache.getStats();
console.log(`Hit rate: ${stats.hitRate * 100}%`);
console.log(`Total keys: ${stats.keys}`);

// Clear cache for a provider
await cache.clearProvider('rapidapi');

// Clear all cache
await cache.clearAll();
```

### Bypass Cache

```typescript
// Search without using cache
const result = await aggregator.searchProducts('Nike', {
  useCache: false
});
```

---

## Error Handling

### Error Types

```typescript
import { ApiError, RateLimitError, ValidationError } from './services/api/types';

try {
  const result = await aggregator.searchProducts('query');
} catch (error) {
  if (error instanceof RateLimitError) {
    // Handle rate limit error
    console.log(`Rate limited. Retry after ${error.retryAfter}ms`);
  } else if (error instanceof ApiError) {
    // Handle API error
    console.log(`API error: ${error.message} (${error.statusCode})`);
  } else if (error instanceof ValidationError) {
    // Handle validation error
    console.log(`Validation error: ${error.field} - ${error.message}`);
  }
}
```

### Retry Logic

The system automatically retries failed requests:

- **Max Attempts:** 3
- **Strategy:** Exponential backoff
- **Retryable Errors:** 408, 429, 500, 502, 503, 504

```typescript
// Request failed -> Wait 1s -> Retry
// Request failed -> Wait 2s -> Retry
// Request failed -> Wait 4s -> Final failure
```

### Graceful Degradation

```typescript
const result = await aggregator.searchProducts('Nike');

if (result.errors && result.errors.length > 0) {
  console.log('Some providers failed:');
  result.errors.forEach(error => {
    console.log(`- ${error.provider}: ${error.error}`);
  });
}

// Continue with available results
console.log(`Got ${result.products.length} products from working providers`);
```

---

## Testing

### Run Tests

```bash
# Run all API tests
npm test -- api

# Run specific test file
npm test -- rapidapi.test.ts

# Run with coverage
npm test -- --coverage api
```

### Manual Testing

#### Test RapidAPI

```bash
curl -X GET "http://localhost:3001/api/products/fetch?brand=Nike&limit=5"
```

#### Test Rainforest API

```bash
curl -X GET "http://localhost:3001/api/products/fetch?category=shoes&limit=5"
```

#### Check Usage Stats

```bash
curl -X GET "http://localhost:3001/api/products/usage"
```

#### Check Health

```bash
curl -X GET "http://localhost:3001/api/products/health"
```

---

## Troubleshooting

### Issue: API Key Not Working

**Solution:**
1. Check `.env` file for correct API key
2. Verify API key is active on provider dashboard
3. Check subscription status (free tier limits)
4. Restart the server after updating `.env`

### Issue: Rate Limit Exceeded

**Solution:**
1. Check daily quota: `GET /api/products/usage`
2. Wait for rate limit reset (midnight UTC)
3. Upgrade to paid tier for higher limits
4. Use caching to reduce API calls

### Issue: Redis Connection Failed

**Solution:**
1. Check Redis server is running: `redis-cli ping`
2. Verify `REDIS_URL` in `.env`
3. System will fallback to in-memory cache
4. Check Redis logs for errors

### Issue: Low Cache Hit Rate

**Solution:**
1. Check cache TTL (increase if needed)
2. Verify Redis is connected
3. Check if queries are similar enough to hit cache
4. Monitor cache stats: `GET /api/products/cache-stats`

### Issue: Slow API Responses

**Solution:**
1. Check API provider status
2. Increase timeout: `API_TIMEOUT=10000`
3. Use caching to avoid repeated calls
4. Reduce concurrent requests

### Issue: Invalid Product Data

**Solution:**
1. Check confidence scores (should be 70-99%)
2. Verify brand mapping in clients
3. Check validation logic in API clients
4. Review API provider response format changes

---

## Best Practices

1. **Always use caching** - Minimize API costs
2. **Monitor rate limits** - Check usage regularly
3. **Batch requests** - Fetch multiple brands/categories together
4. **Handle errors gracefully** - Don't crash on API failures
5. **Log API calls** - Use `api_logs` table for debugging
6. **Validate data** - Check confidence scores before saving
7. **Test with real keys** - Use actual API keys for realistic testing
8. **Stay within quotas** - Monitor daily usage closely

---

## Support

For issues or questions:
- Check logs in `api_logs` table
- Review error messages in responses
- Check API provider status pages
- Review this documentation

---

## License

PromoFinder - Fashion Deals Aggregator
