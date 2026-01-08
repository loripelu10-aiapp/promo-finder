const fs = require('fs');

// Load all product sources - comprehensive list
const sources = [
  { file: '/tmp/nike-expanded.json', brand: 'Nike', commission: '11%' },
  { file: '/tmp/puma-expanded.json', brand: 'Puma', commission: '8%' },
  { file: '/tmp/hm-batch2.json', brand: 'H&M', commission: '7%' },
  { file: '/tmp/6pm-products.json', brand: '6pm', commission: '6%' },
  { file: '/tmp/champion-products.json', brand: 'Champion', commission: '7%' },
  { file: '/tmp/finishline-products.json', brand: 'Finish Line', commission: '4%' },
  { file: '/tmp/nordstromrack-products.json', brand: 'Nordstrom Rack', commission: '5%' },
  { file: '/tmp/underarmour-products.json', brand: 'Under Armour', commission: '5%' },
  { file: '/tmp/zappos-products.json', brand: 'Zappos', commission: '6%' },
  { file: '/tmp/skechers-products.json', brand: 'Skechers', commission: '5%' },
  { file: '/tmp/reebok-products.json', brand: 'Reebok', commission: '5%' },
  { file: '/tmp/newbalance-products.json', brand: 'New Balance', commission: '4%' },
  { file: '/tmp/converse-products.json', brand: 'Converse', commission: '6%' },
  { file: '/tmp/jdsports-products.json', brand: 'JD Sports', commission: '4%' },
  { file: '/tmp/dicks-products.json', brand: "Dick's Sporting Goods", commission: '4%' },
  { file: '/tmp/macys-products.json', brand: "Macy's", commission: '4%' },
  { file: '/tmp/lululemon-products.json', brand: 'Lululemon', commission: '5%' },
  { file: '/tmp/oldnavy-products.json', brand: 'Old Navy', commission: '4%' },
  { file: '/tmp/target-products.json', brand: 'Target', commission: '4%' },
  { file: '/tmp/kohls-products.json', brand: "Kohl's", commission: '4%' },
  { file: '/tmp/jcpenney-products.json', brand: 'JCPenney', commission: '4%' },
  { file: '/tmp/vans-products.json', brand: 'Vans', commission: '5%' },
  { file: '/tmp/forever21-products.json', brand: 'Forever 21', commission: '4%' },
  { file: '/tmp/express-products.json', brand: 'Express', commission: '4%' },
  { file: '/tmp/americaneagle-products.json', brand: 'American Eagle', commission: '4%' }
];

// Parse price from string or number
function parsePrice(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const match = val.replace(/[^0-9.]/g, '');
    return parseFloat(match) || 0;
  }
  return 0;
}

// Normalize products to common format
function normalizeProduct(p, source) {
  const url = p.affiliateUrl || p.url || p.productUrl || '';
  const image = p.image || p.imageUrl || '';

  // Skip invalid products
  if (!p.name || !url) return null;

  const salePrice = parsePrice(p.salePrice);
  if (salePrice <= 0) return null;

  const originalPrice = parsePrice(p.originalPrice) || salePrice * 1.25;

  // Skip if no real discount
  if (originalPrice <= salePrice) return null;

  return {
    id: p.id || source.brand.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    name: p.name,
    brand: p.brand || source.brand,
    merchant: source.brand.toLowerCase().replace(/[^a-z0-9]/g, ''),
    merchantName: source.brand,
    originalPrice: originalPrice,
    salePrice: salePrice,
    discount: Math.round((1 - salePrice / originalPrice) * 100),
    currency: p.currency || 'USD',
    image: image || 'https://via.placeholder.com/400x400?text=' + encodeURIComponent(source.brand),
    affiliateUrl: url,
    category: p.category || 'shoes',
    inStock: true,
    commission: source.commission,
    lastUpdated: new Date().toISOString()
  };
}

console.log('Loading products from all sources...\n');

const allProducts = [];
const stats = {};

for (const source of sources) {
  try {
    const raw = JSON.parse(fs.readFileSync(source.file, 'utf8'));
    const products = Array.isArray(raw) ? raw : (raw.products || []);

    let validCount = 0;
    for (const p of products) {
      const normalized = normalizeProduct(p, source);
      if (normalized) {
        allProducts.push(normalized);
        validCount++;
      }
    }

    stats[source.brand] = validCount;
    if (validCount > 0) {
      console.log(`${source.brand}: ${validCount} valid products`);
    }
  } catch (e) {
    // Skip missing files silently
  }
}

console.log('\nDeduplicating...');

// Deduplicate by URL
const seen = new Set();
const unique = allProducts.filter(p => {
  const key = (p.affiliateUrl || '').split('?')[0].toLowerCase();
  if (!key || seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`Removed ${allProducts.length - unique.length} duplicates\n`);

// Save merged products
fs.writeFileSync('data/products.json', JSON.stringify(unique, null, 2));

console.log('=== FINAL MERGE COMPLETE ===');
console.log('Total unique products:', unique.length);
console.log('');
console.log('By brand:');
const byBrand = {};
unique.forEach(p => {
  const brand = p.merchantName || p.brand || 'Unknown';
  byBrand[brand] = (byBrand[brand] || 0) + 1;
});
Object.entries(byBrand).sort((a,b) => b[1] - a[1]).forEach(([brand, count]) => {
  console.log(`  ${brand}: ${count}`);
});

console.log('\nSaved to data/products.json');
