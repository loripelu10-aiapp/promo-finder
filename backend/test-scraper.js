const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Test scraper per vedere cosa riusciamo ad estrarre
 */
async function testScraper() {
  console.log('🧪 Testing scraper capabilities...\n');

  // Test 1: H&M (più semplice, meno protezioni)
  try {
    console.log('📍 Testing H&M...');
    const response = await axios.get('https://www2.hm.com/it_it/sale/shopbyproduct/view-all.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    console.log('✅ H&M - Page loaded successfully');
    console.log('📊 Stats:');
    console.log(`   - Total images: ${$('img').length}`);
    console.log(`   - Total links: ${$('a').length}`);
    console.log(`   - Article tags: ${$('article').length}`);
    console.log(`   - Product items: ${$('.product-item, [class*="product"]').length}`);

    // Trova il primo prodotto e analizzalo
    const firstProduct = $('article, li.product-item, [class*="product-item"]').first();
    if (firstProduct.length > 0) {
      console.log('\n🔍 First product analysis:');
      console.log('HTML preview:', firstProduct.html()?.substring(0, 500));
    }

  } catch (error) {
    console.error('❌ H&M error:', error.message);
  }

  // Test 2: Controlla una URL specifica di prodotto
  console.log('\n\n📍 Testing direct product URL...');
  try {
    const productUrl = 'https://www2.hm.com/it_it/productpage.0608945036.html';
    const response = await axios.get(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    console.log('✅ Product page loaded');
    console.log('Product images found:', $('img[class*="product"], img[class*="ProductImage"]').length);
    console.log('Price elements found:', $('[class*="price"], [class*="Price"]').length);

    // Estrai immagine prodotto
    const productImage = $('img[class*="product"], img[class*="ProductImage"]').first().attr('src');
    console.log('Product image URL:', productImage);

  } catch (error) {
    console.error('❌ Product page error:', error.message);
  }
}

testScraper();
