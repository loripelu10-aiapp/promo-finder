# Decathlon EU Scraper

Professional web scraper for Decathlon UK/EU that extracts sports shoes on sale with real discounts.

## Overview

- **Target Site**: https://www.decathlon.co.uk/deals
- **Product Focus**: Sports shoes/footwear on sale
- **Currency**: GBP (£)
- **Regions**: EU, UK, FR, DE, IT, ES
- **Max Products**: 30 per scrape

## Features

- **Real Discounts Only**: Validates that products have BOTH original and sale prices
- **Strict Validation**: Rejects discounts outside 10-70% range
- **Anti-Detection**: Uses Puppeteer with stealth plugin
- **Smart Filtering**: Only extracts footwear products
- **Brand Recognition**: Identifies Nike, Adidas, Puma, and Decathlon's own brands (Kalenji, Kipsta, etc.)
- **Multiple Selectors**: Tries various CSS selectors to handle site changes

## Installation

```bash
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
```

## Usage

### Basic Usage

```javascript
const DecathlonEUScraper = require('./scrapers/eu-retailers/decathlon-eu');

const scraper = new DecathlonEUScraper({ maxProducts: 30 });
const products = await scraper.scrape();

console.log(`Found ${products.length} sports shoes on sale`);
```

### Custom Configuration

```javascript
const scraper = new DecathlonEUScraper({
  maxProducts: 50,
  scrollDelay: 3000,
  rateLimit: 3000,
  timeout: 60000,
  headless: true
});
```

## Product Schema

Each product object contains:

```javascript
{
  id: 'decathlon-eu-1234567890-0',
  name: 'Kalenji Run Active Running Shoes',
  brand: 'Kalenji',
  category: 'shoes',
  originalPrice: 49.99,
  salePrice: 34.99,
  discount: 30,
  currency: 'GBP',
  image: 'https://...jpg',
  url: 'https://www.decathlon.co.uk/p/...',
  source: 'decathlon.co.uk',
  availableRegions: ['EU', 'UK', 'FR', 'DE', 'IT', 'ES'],
  verified: false,
  scrapedAt: '2026-01-07T17:19:00.000Z'
}
```

## Discount Validation

The scraper performs strict validation:

1. **Both Prices Required**: Must have original AND sale price (no estimation)
2. **Price Logic**: Original price MUST be greater than sale price
3. **Realistic Range**: Discount must be between 10-70%
4. **No Fake Patterns**: Rejects 1.3x estimation patterns (fake 30% discounts)

### Example Validations

```javascript
// ✅ VALID - Real discount
originalPrice: 89.99
salePrice: 53.99
discount: 40% ✓

// ❌ REJECTED - Discount too small
originalPrice: 50.00
salePrice: 48.00
discount: 4% ✗

// ❌ REJECTED - Original < Sale
originalPrice: 40.00
salePrice: 50.00
discount: -25% ✗

// ❌ REJECTED - Missing original price
originalPrice: null
salePrice: 45.00
discount: estimated ✗
```

## Supported Brands

### Major Brands
- Nike
- Adidas
- Puma
- New Balance
- Asics
- Reebok

### Decathlon Brands
- **Kalenji** - Running
- **Kipsta** - Football/Team sports
- **Domyos** - Fitness/Training
- **Quechua** - Hiking/Outdoor
- **Artengo** - Tennis/Racket sports
- **Inesis** - Golf
- **Rockrider** - Mountain biking
- **B'Twin/Btwin** - Cycling

## Shoe Categories

The scraper recognizes and categorizes:

- Running shoes
- Trail running shoes
- Walking shoes
- Football/Soccer shoes
- Basketball shoes
- Tennis shoes
- Training/Gym shoes
- General sports shoes

## Technical Details

### CSS Selectors

The scraper tries multiple selectors in order:

```javascript
[data-testid="product-card"]
article[data-product-id]
div[class*="ProductCard"]
div[class*="product-card"]
li[class*="product"]
article[class*="product"]
[class*="ProductTile"]
a[href*="/p/"]
div[class*="product-item"]
[data-product-sku]
```

### Scraping Process

1. Navigate to Decathlon sale page
2. Wait for JavaScript rendering (8 seconds)
3. Take debug screenshot for troubleshooting
4. Detect working product selector
5. Scroll to load more products (3 scrolls)
6. Extract product data in browser context
7. Filter for footwear only
8. Validate prices and discounts
9. Return validated products

### Anti-Detection Measures

- Stealth plugin enabled
- Random user agent
- Human-like scrolling
- Rate limiting between requests
- Realistic viewport size (1920x1080)
- Disabled automation flags

## Testing

Run the validation test:

```bash
node test-decathlon-eu.js
```

This will:
- Extract up to 30 products
- Validate discount calculations
- Check image URLs (first 5 products)
- Check product URLs (first 3 products)
- Verify all products are footwear
- Confirm real discounts only

## Debugging

If scraping fails:

1. Check debug screenshot: `/tmp/decathlon-eu-debug.png`
2. Review console logs for selector detection
3. Verify site structure hasn't changed
4. Check if Decathlon is blocking the IP

## Error Handling

The scraper handles:
- Site blocking detection
- Invalid product data
- Missing prices
- Broken images/URLs
- JavaScript rendering delays
- Network timeouts

## Region Configuration

The scraper is tagged for EU availability:

```javascript
availableRegions: ['EU', 'UK', 'FR', 'DE', 'IT', 'ES']
```

Decathlon operates across Europe with localized sites. For other regions, update the `source` URL:

- UK: `https://www.decathlon.co.uk`
- France: `https://www.decathlon.fr`
- Germany: `https://www.decathlon.de`
- Italy: `https://www.decathlon.it`
- Spain: `https://www.decathlon.es`

## Performance

- **Max Products**: 30 (configurable)
- **Scroll Delay**: 3 seconds between scrolls
- **Rate Limit**: 3 seconds between requests
- **Timeout**: 60 seconds per page
- **Average Runtime**: 30-60 seconds

## Best Practices

1. **Respect Rate Limits**: Don't scrape too frequently
2. **Monitor Changes**: Decathlon may update their site structure
3. **Handle Errors**: Always wrap scraper calls in try-catch
4. **Validate Output**: Check product quality before database insertion
5. **Use Proxies**: For production, consider rotating proxies

## Limitations

- Only scrapes UK site (can be adapted for other regions)
- Maximum 30 products per run (configurable)
- Requires headless browser (resource intensive)
- May need selector updates if site changes
- Subject to site's robots.txt and terms of service

## Maintenance

### If Scraper Stops Working

1. **Update Selectors**: Site redesign likely changed CSS classes
2. **Check URL**: Sale page URL may have changed
3. **Increase Delays**: Site may need more time to render
4. **Update User Agent**: Browser fingerprint may be detected

### Selector Update Process

1. Visit https://www.decathlon.co.uk/deals
2. Inspect product cards in DevTools
3. Identify new CSS classes/attributes
4. Update `productSelectors` array in code
5. Test with `test-decathlon-eu.js`

## License

Part of the Promo Finder backend scraping system.

## Related Files

- Base scraper: `/backend/scrapers/brands/base-scraper.js`
- Test script: `/backend/test-decathlon-eu.js`
- Other EU scrapers: `/backend/scrapers/eu-retailers/`

## Support

For issues or questions about this scraper:
1. Check debug screenshot first
2. Review console logs
3. Verify site accessibility
4. Update selectors if needed
