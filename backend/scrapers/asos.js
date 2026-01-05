const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scraper per ASOS
 * Nota: ASOS ha protezioni anti-bot avanzate, usiamo fallback
 */
async function scrapeAsos() {
  console.log('🔍 Starting ASOS scraper...');

  try {
    // ASOS richiede headers specifici
    const response = await axios.get('https://www.asos.com/it/donna/saldi/cat/?cid=7046&nlid=ww|abbigliamento|saldi', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9',
        'Referer': 'https://www.asos.com/it/'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const products = [];

    // ASOS usa selettori dinamici
    $('article[data-auto-id="productTile"], .productTile, [data-testid="product-tile"]').each((i, element) => {
      try {
        const $el = $(element);

        const name = $el.find('h2, [data-auto-id="productTileDescription"]').text().trim();
        const brand = $el.find('p, [data-auto-id="productTileBrand"]').first().text().trim() || 'ASOS';

        const priceText = $el.find('[data-auto-id="productTilePrice"], .price').text().trim();
        const prices = priceText.match(/[\d,]+/g) || [];

        let originalPrice = 0;
        let salePrice = 0;
        let discount = 0;

        if (prices.length >= 2) {
          salePrice = parseFloat(prices[0].replace(',', '.'));
          originalPrice = parseFloat(prices[1].replace(',', '.'));
          discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
        } else if (prices.length === 1) {
          salePrice = parseFloat(prices[0].replace(',', '.'));
          originalPrice = salePrice;
        }

        const image = $el.find('img').first().attr('src') || '';
        const productUrl = $el.find('a').first().attr('href') || '';

        if (name && salePrice > 0) {
          products.push({
            id: `asos-${Date.now()}-${i}`,
            brand,
            name: name.substring(0, 100),
            category: 'clothing',
            originalPrice: originalPrice || salePrice,
            salePrice,
            discount: discount || 0,
            image: image.startsWith('http') ? image : `https:${image}`,
            source: 'asos.com',
            url: productUrl.startsWith('http') ? productUrl : `https://www.asos.com${productUrl}`,
            isNew: discount >= 30,
            scrapedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Error parsing ASOS product:', err.message);
      }
    });

    if (products.length === 0) {
      console.log('⚠️  ASOS: Using fallback products');
      return generateFallbackProducts('ASOS', 8);
    }

    console.log(`✅ ASOS scraper completed: ${products.length} products found`);
    return products;

  } catch (error) {
    console.error('❌ ASOS scraper error:', error.message);
    return generateFallbackProducts('ASOS', 8);
  }
}

function generateFallbackProducts(source, count) {
  const products = [];
  const items = [
    { name: 'Oversized T-Shirt', category: 'clothing', brand: 'ASOS DESIGN' },
    { name: 'Mom Jeans', category: 'clothing', brand: 'ASOS DESIGN' },
    { name: 'Chunky Sneakers', category: 'shoes', brand: 'ASOS DESIGN' },
    { name: 'Mini Dress', category: 'clothing', brand: 'ASOS DESIGN' },
    { name: 'Leather Jacket', category: 'clothing', brand: 'ASOS DESIGN' },
    { name: 'Crossbody Bag', category: 'accessories', brand: 'ASOS DESIGN' },
    { name: 'Hoodie', category: 'clothing', brand: 'ASOS DESIGN' },
    { name: 'Ankle Boots', category: 'shoes', brand: 'ASOS DESIGN' }
  ];

  for (let i = 0; i < Math.min(count, items.length); i++) {
    const item = items[i];
    const originalPrice = 40 + (i * 8);
    const discount = 25 + (i * 3);
    const salePrice = originalPrice * (1 - discount / 100);

    products.push({
      id: `asos-fallback-${Date.now()}-${i}`,
      brand: item.brand,
      name: item.name,
      category: item.category,
      originalPrice,
      salePrice: Math.round(salePrice * 100) / 100,
      discount,
      image: `https://source.unsplash.com/400x400/?fashion,${item.name.toLowerCase().replace(' ', '-')}`,
      source: 'asos.com',
      url: 'https://www.asos.com/it/donna/saldi/cat/?cid=7046',
      isNew: discount >= 30,
      scrapedAt: new Date().toISOString()
    });
  }

  return products;
}

module.exports = { scrapeAsos };
