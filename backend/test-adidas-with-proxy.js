/**
 * Test Adidas Scraper WITH Residential Proxy
 *
 * SETUP INSTRUCTIONS:
 * 1. Sign up for Bright Data: https://brightdata.com (1GB free trial)
 * 2. Go to Dashboard → Proxies → Residential Proxies
 * 3. Copy your credentials below
 * 4. Run: node test-adidas-with-proxy.js
 */

const AdidasOutletFocused = require('./scrapers/brands/adidas-outlet-focused');

// ========================================
// ADD YOUR PROXY CREDENTIALS HERE
// ========================================

const USE_PROXY = false; // Set to true after adding credentials

const proxyConfig = {
  // Bright Data example:
  server: 'http://brd.superproxy.io:22225',
  username: 'brd-customer-YOUR-ID-zone-residential_proxy1', // REPLACE THIS
  password: 'YOUR-PASSWORD', // REPLACE THIS

  // Smartproxy example (alternative):
  // server: 'http://gate.smartproxy.com:7000',
  // username: 'spYOUR-USERNAME',
  // password: 'YOUR-PASSWORD',
};

// ========================================

async function testAdidasWithProxy() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING ADIDAS SCRAPER WITH RESIDENTIAL PROXY');
  console.log('='.repeat(80));

  if (!USE_PROXY) {
    console.log('\n⚠️  WARNING: Proxy is disabled!');
    console.log('\n📋 To enable proxy:');
    console.log('   1. Sign up for Bright Data: https://brightdata.com');
    console.log('   2. Get your proxy credentials from dashboard');
    console.log('   3. Edit this file and add credentials to proxyConfig');
    console.log('   4. Set USE_PROXY = true');
    console.log('\n❌ Exiting...\n');
    process.exit(1);
  }

  // Validate credentials
  if (proxyConfig.username.includes('YOUR-ID') || proxyConfig.password.includes('YOUR-PASSWORD')) {
    console.log('\n❌ ERROR: You need to add your actual proxy credentials!');
    console.log('\nEdit this file and replace:');
    console.log('   - "YOUR-ID" with your actual customer ID');
    console.log('   - "YOUR-PASSWORD" with your actual password');
    console.log('\n');
    process.exit(1);
  }

  console.log('\n✅ Proxy configured:');
  console.log(`   Server: ${proxyConfig.server}`);
  console.log(`   Username: ${proxyConfig.username}`);
  console.log('='.repeat(80) + '\n');

  const scraper = new AdidasOutletFocused({
    headless: true,
    maxProducts: 15,
    proxy: proxyConfig
  });

  try {
    console.log('🚀 Starting scrape with proxy...\n');

    const products = await scraper.scrape();

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTS');
    console.log('='.repeat(80));

    if (products.length > 0) {
      console.log(`\n✅ SUCCESS! Proxy is working!`);
      console.log(`📦 Found ${products.length} Adidas products\n`);

      console.log('Sample products:\n');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   $${p.originalPrice} → $${p.salePrice} (${p.discount}% off)`);
        console.log(`   URL: ${p.url.substring(0, 70)}...`);
        console.log('');
      });

      console.log('='.repeat(80));
      console.log('🎉 PROXY SOLUTION WORKS!');
      console.log('='.repeat(80));
      console.log('\n✅ You can now scrape Adidas with 0 errors!');
      console.log('\nNext steps:');
      console.log('   1. Move proxy config to environment variables');
      console.log('   2. Integrate with orchestrator');
      console.log('   3. Set up cron jobs for automated scraping');
      console.log('   4. Monitor bandwidth usage\n');

      process.exit(0);
    } else {
      console.log('\n⚠️  Proxy connected but no products found');
      console.log('\nPossible reasons:');
      console.log('   1. CSS selectors need updating (Adidas changed their site)');
      console.log('   2. Proxy region is blocked (try different proxy location)');
      console.log('   3. Page took too long to load (increase timeout)');
      console.log('\nCheck screenshots in /tmp/adidas-attempt-*.png\n');

      process.exit(1);
    }

  } catch (error) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ ERROR');
    console.log('='.repeat(80));
    console.error(`\nError: ${error.message}\n`);

    if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      console.log('🔧 Troubleshooting proxy connection issues:\n');
      console.log('   1. Verify proxy credentials are correct');
      console.log('   2. Check if proxy service is running');
      console.log('   3. Test proxy with curl:');
      console.log(`      curl -x ${proxyConfig.server} \\`);
      console.log(`           -U "${proxyConfig.username}:${proxyConfig.password}" \\`);
      console.log(`           https://lumtest.com/myip.json`);
      console.log('   4. Check Bright Data dashboard for usage limits\n');
    }

    if (error.message.includes('402') || error.message.includes('Payment Required')) {
      console.log('💳 Payment/Bandwidth Issue:\n');
      console.log('   - Free trial may have expired');
      console.log('   - Add payment method to Bright Data');
      console.log('   - Or switch to pay-as-you-go plan\n');
    }

    console.log('Full error:');
    console.error(error.stack);
    console.log('');

    process.exit(1);
  }
}

// Run test
testAdidasWithProxy();
