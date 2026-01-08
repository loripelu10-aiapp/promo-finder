/**
 * Test price extraction and discount calculation
 */

const NikeScraper = require('./scrapers/brands/nike-puppeteer');

const scraper = new NikeScraper();

// Test cases from actual Nike page
const testCases = [
  { sale: '$80.97', original: '$115', expected: 29.6 },
  { sale: '$93.97', original: '$125', expected: 24.8 },
  { sale: '$119.97', original: '$170', expected: 29.4 },
  { sale: '$56.97', original: '$80', expected: 28.8 },
  { sale: '$101.97', original: '$135', expected: 24.5 }
];

console.log('🧪 Testing price extraction and discount calculation:\n');

testCases.forEach(test => {
  const salePrice = scraper.extractPrice(test.sale);
  const originalPrice = scraper.extractPrice(test.original);
  const discount = ((originalPrice - salePrice) / originalPrice) * 100;
  const validation = scraper.isRealDiscount(originalPrice, salePrice);

  console.log(`${test.sale} → ${test.original}`);
  console.log(`  Extracted: $${salePrice} → $${originalPrice}`);
  console.log(`  Discount: ${discount.toFixed(1)}% (expected ~${test.expected}%)`);
  console.log(`  Valid: ${validation.valid ? '✅' : '❌'} ${validation.reason || validation.discount + '%'}`);
  console.log('');
});
