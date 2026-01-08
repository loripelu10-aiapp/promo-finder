const fs = require('fs');

// Load all product sources
const nikeExpanded = JSON.parse(fs.readFileSync('/tmp/nike-expanded.json', 'utf8'));
const pumaExpanded = JSON.parse(fs.readFileSync('/tmp/puma-expanded.json', 'utf8'));
const hmProducts = JSON.parse(fs.readFileSync('/tmp/hm-batch2.json', 'utf8'));

// Normalize products to common format
function normalizeProduct(p, source) {
  return {
    id: p.id || source + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    name: p.name,
    brand: p.brand || source,
    merchant: p.merchant || source.toLowerCase(),
    merchantName: p.merchantName || p.brand || source,
    originalPrice: p.originalPrice,
    salePrice: p.salePrice,
    discount: p.discount || Math.round((1 - p.salePrice / p.originalPrice) * 100),
    currency: p.currency || 'USD',
    image: p.image || p.imageUrl,
    affiliateUrl: p.affiliateUrl || p.url,
    category: p.category || 'shoes',
    inStock: p.inStock !== false,
    commission: p.commission || '8%',
    lastUpdated: p.lastUpdated || p.scrapedAt || new Date().toISOString()
  };
}

// Combine all products
const allProducts = [
  ...nikeExpanded.map(p => normalizeProduct(p, 'Nike')),
  ...pumaExpanded.map(p => normalizeProduct(p, 'Puma')),
  ...hmProducts.map(p => normalizeProduct(p, 'H&M'))
];

// Deduplicate by URL
const seen = new Set();
const unique = allProducts.filter(p => {
  const key = (p.affiliateUrl || p.url || '').split('?')[0];
  if (!key || seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Save merged products
fs.writeFileSync('data/products.json', JSON.stringify(unique, null, 2));
console.log('=== MERGE COMPLETE ===');
console.log('Total unique products:', unique.length);
console.log('');
console.log('By brand:');
const byBrand = {};
unique.forEach(p => {
  const brand = p.brand || 'Unknown';
  byBrand[brand] = (byBrand[brand] || 0) + 1;
});
Object.entries(byBrand).sort((a,b) => b[1] - a[1]).forEach(([brand, count]) => {
  console.log('  ' + brand + ':', count);
});
