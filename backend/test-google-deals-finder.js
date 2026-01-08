/**
 * Test Google Deals Finder
 */

const GoogleDealsFinder = require('./scrapers/websearch/google-deals-finder');

async function testGoogleDeals() {
  console.log('🧪 Testing Google Deals Finder...\n');

  const finder = new GoogleDealsFinder({
    headless: true,
    maxResults: 10
  });

  try {
    // Test 1: Search for Adidas deals
    console.log('=' .repeat(60));
    console.log('Test 1: Finding Adidas shoe deals');
    console.log('='.repeat(60) + '\n');

    const adidasDeals = await finder.findBrandDeals('Adidas', 'shoes');

    console.log(`\n📊 Results: Found ${adidasDeals.length} Adidas deal URLs\n`);

    if (adidasDeals.length > 0) {
      console.log('📋 Sample URLs:\n');
      adidasDeals.slice(0, 5).forEach((deal, i) => {
        console.log(`${i + 1}. ${deal.title}`);
        console.log(`   URL: ${deal.url}`);
        console.log(`   Snippet: ${deal.snippet.substring(0, 100)}...`);
        console.log('');
      });
    }

    if (adidasDeals.length >= 5) {
      console.log('✅ PASS: Successfully found Adidas deal URLs via Google search!');
      return true;
    } else {
      console.log('⚠️  Found some results but less than expected');
      return false;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

testGoogleDeals();
