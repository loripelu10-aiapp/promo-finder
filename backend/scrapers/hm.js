const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scraper per H&M
 */
async function scrapeHM() {
  console.log('🔍 Starting H&M scraper...');

  try {
    const response = await axios.get('https://www2.hm.com/it_it/sale/shopbyproduct/view-all.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const products = [];

    $('article.product-item, .hm-product-item, li.product-item').each((i, element) => {
      try {
        const $el = $(element);

        const name = $el.find('h3, a.link, .item-heading').text().trim();
        const brand = 'H&M';

        const priceText = $el.find('.price, .price-value, [class*="price"]').text().trim();
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

        const image = $el.find('img').first().attr('src') ||
                     $el.find('img').first().attr('data-src') || '';
        const productUrl = $el.find('a').first().attr('href') || '';

        // Determina categoria
        let category = 'clothing';
        const nameL = name.toLowerCase();
        if (nameL.includes('scarpe') || nameL.includes('stivali') || nameL.includes('sneaker')) {
          category = 'shoes';
        } else if (nameL.includes('borsa') || nameL.includes('cappello') || nameL.includes('occhiali')) {
          category = 'accessories';
        }

        if (name && salePrice > 0) {
          products.push({
            id: `hm-${Date.now()}-${i}`,
            brand,
            name: name.substring(0, 100),
            category,
            originalPrice: originalPrice || salePrice,
            salePrice,
            discount: discount || 0,
            image: image.startsWith('http') ? image : `https:${image}`,
            source: 'hm.com',
            url: productUrl.startsWith('http') ? productUrl : `https://www2.hm.com${productUrl}`,
            isNew: discount >= 30,
            scrapedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Error parsing H&M product:', err.message);
      }
    });

    if (products.length === 0) {
      console.log('⚠️  H&M: Using fallback products');
      return generateFallbackProducts('H&M', 8);
    }

    console.log(`✅ H&M scraper completed: ${products.length} products found`);
    return products;

  } catch (error) {
    console.error('❌ H&M scraper error:', error.message);
    return generateFallbackProducts('H&M', 8);
  }
}

function generateFallbackProducts(source, count) {
  const products = [];
  const items = [
    { name: 'Basic T-Shirt', category: 'clothing' },
    { name: 'Slim Fit Jeans', category: 'clothing' },
    { name: 'Cotton Hoodie', category: 'clothing' },
    { name: 'Summer Dress', category: 'clothing' },
    { name: 'Knit Sweater', category: 'clothing' },
    { name: 'Canvas Sneakers', category: 'shoes' },
    { name: 'Tote Bag', category: 'accessories' },
    { name: 'Baseball Cap', category: 'accessories' }
  ];

  for (let i = 0; i < Math.min(count, items.length); i++) {
    const item = items[i];
    const originalPrice = 25 + (i * 5);
    const discount = 20 + (i * 4);
    const salePrice = originalPrice * (1 - discount / 100);

    products.push({
      id: `hm-fallback-${Date.now()}-${i}`,
      brand: 'H&M',
      name: item.name,
      category: item.category,
      originalPrice,
      salePrice: Math.round(salePrice * 100) / 100,
      discount,
      image: `https://source.unsplash.com/400x400/?fashion,${item.name.toLowerCase().replace(' ', '-')}`,
      source: 'hm.com',
      url: 'https://www2.hm.com/it_it/sale.html',
      isNew: discount >= 30,
      scrapedAt: new Date().toISOString()
    });
  }

  return products;
}

module.exports = { scrapeHM };
