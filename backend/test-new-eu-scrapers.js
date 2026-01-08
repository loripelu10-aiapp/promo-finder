const ASOSSaleScraper = require('./scrapers/eu-retailers/asos-sale');
const ZalandoEUScraper = require('./scrapers/eu-retailers/zalando-eu');
const axios = require('axios');

/**
 * Validation Script for New EU Scrapers
 *
 * Tests ASOS and Zalando scrapers to verify:
 * - Products have real discounts (no false promotions)
 * - Images load correctly
 * - URLs are valid
 * - Discount percentages are realistic (10-70%)
 */

async function validateImageUrl(imageUrl) {
  try {
    const response = await axios.head(imageUrl, { timeout: 5000 });
    const contentType = response.headers['content-type'];
    return {
      valid: response.status === 200 && contentType?.startsWith('image/'),
      status: response.status,
      contentType
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

async function validateProductUrl(productUrl) {
  try {
    const response = await axios.head(productUrl, {
      timeout: 5000,
      maxRedirects: 5
    });
    return {
      valid: response.status === 200,
      status: response.status
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

function validateDiscount(product) {
  const issues = [];

  // Check original price > sale price
  if (product.originalPrice <= product.salePrice) {
    issues.push(`❌ Original price (${product.originalPrice}) not greater than sale price (${product.salePrice})`);
  }

  // Check discount percentage
  const calculatedDiscount = Math.round(
    ((product.originalPrice - product.salePrice) / product.originalPrice) * 100
  );

  if (Math.abs(calculatedDiscount - product.discount) > 2) {
    issues.push(`⚠️  Discount mismatch: shown ${product.discount}%, calculated ${calculatedDiscount}%`);
  }

  if (product.discount < 10 || product.discount > 70) {
    issues.push(`❌ Unrealistic discount: ${product.discount}%`);
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

async function testScraper(ScraperClass, scraperName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing ${scraperName}`);
  console.log('='.repeat(60));

  const scraper = new ScraperClass({ maxProducts: 10 });

  try {
    console.log('⏳ Scraping products...');
    const products = await scraper.scrape();

    console.log(`\n📊 Results: ${products.length} products extracted`);

    if (products.length === 0) {
      console.log('❌ No products found - scraper may be broken');
      return {
        scraper: scraperName,
        success: false,
        productCount: 0,
        validProducts: 0,
        issues: ['No products extracted']
      };
    }

    let validCount = 0;
    const allIssues = [];

    console.log('\n🔍 Validating products...\n');

    for (let i = 0; i < Math.min(products.length, 5); i++) {
      const product = products[i];
      const productIssues = [];

      console.log(`\n${i + 1}. ${product.name}`);
      console.log(`   Brand: ${product.brand}`);
      console.log(`   Price: ${product.currency}${product.salePrice} (was ${product.currency}${product.originalPrice})`);
      console.log(`   Discount: ${product.discount}%`);
      console.log(`   Source: ${product.source}`);
      console.log(`   Regions: ${product.availableRegions.join(', ')}`);

      // Validate discount
      const discountCheck = validateDiscount(product);
      if (!discountCheck.valid) {
        productIssues.push(...discountCheck.issues);
        discountCheck.issues.forEach(issue => console.log(`   ${issue}`));
      } else {
        console.log('   ✅ Discount is valid');
      }

      // Validate image URL (check first 3 products)
      if (i < 3) {
        console.log('   ⏳ Checking image URL...');
        const imageCheck = await validateImageUrl(product.image);
        if (!imageCheck.valid) {
          const issue = `Image URL broken: ${imageCheck.error || imageCheck.status}`;
          productIssues.push(issue);
          console.log(`   ❌ ${issue}`);
        } else {
          console.log(`   ✅ Image loads correctly (${imageCheck.contentType})`);
        }
      }

      // Validate product URL (check first 2 products)
      if (i < 2) {
        console.log('   ⏳ Checking product URL...');
        const urlCheck = await validateProductUrl(product.url);
        if (!urlCheck.valid) {
          const issue = `Product URL broken: ${urlCheck.error || urlCheck.status}`;
          productIssues.push(issue);
          console.log(`   ❌ ${issue}`);
        } else {
          console.log(`   ✅ Product URL is valid (${urlCheck.status})`);
        }
      }

      if (productIssues.length === 0) {
        validCount++;
        console.log('   ✅ Product is VALID');
      } else {
        allIssues.push(`Product ${i + 1}: ${productIssues.join(', ')}`);
      }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📈 ${scraperName} Summary`);
    console.log('='.repeat(60));
    console.log(`Total products extracted: ${products.length}`);
    console.log(`Products validated: ${Math.min(products.length, 5)}`);
    console.log(`Valid products: ${validCount}/${Math.min(products.length, 5)}`);

    if (allIssues.length > 0) {
      console.log(`\n⚠️  Issues found:`);
      allIssues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log(`\n✅ All validated products passed checks!`);
    }

    return {
      scraper: scraperName,
      success: true,
      productCount: products.length,
      validProducts: validCount,
      issues: allIssues
    };

  } catch (error) {
    console.log(`\n❌ Scraper failed with error:`);
    console.log(`   ${error.message}`);
    console.log(`\n   Stack trace:`);
    console.log(error.stack);

    return {
      scraper: scraperName,
      success: false,
      productCount: 0,
      validProducts: 0,
      issues: [error.message]
    };
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   EU Retailers Scraper Validation Test                   ║');
  console.log('║   Testing: ASOS Sale + Zalando EU                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const results = [];

  // Test ASOS
  const asosResult = await testScraper(ASOSSaleScraper, 'ASOS Sale Scraper');
  results.push(asosResult);

  // Delay between scrapers
  console.log('\n⏳ Waiting 3 seconds before next scraper...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test Zalando
  const zalandoResult = await testScraper(ZalandoEUScraper, 'Zalando EU Scraper');
  results.push(zalandoResult);

  // Final summary
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   FINAL VALIDATION SUMMARY                                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  results.forEach(result => {
    const status = result.success && result.validProducts > 0 ? '✅' : '❌';
    console.log(`${status} ${result.scraper}`);
    console.log(`   Products: ${result.productCount}`);
    console.log(`   Valid: ${result.validProducts}`);
    if (result.issues.length > 0) {
      console.log(`   Issues: ${result.issues.length}`);
    }
    console.log('');
  });

  const allSuccessful = results.every(r => r.success && r.validProducts > 0);
  const totalProducts = results.reduce((sum, r) => sum + r.productCount, 0);
  const totalValid = results.reduce((sum, r) => sum + r.validProducts, 0);

  console.log('─'.repeat(60));
  console.log(`Total products extracted: ${totalProducts}`);
  console.log(`Total valid products: ${totalValid}`);
  console.log(`Success rate: ${totalProducts > 0 ? Math.round((totalValid / totalProducts) * 100) : 0}%`);
  console.log('─'.repeat(60));

  if (allSuccessful) {
    console.log('\n🎉 All scrapers passed validation!');
    console.log('✅ Ready to integrate into production');
  } else {
    console.log('\n⚠️  Some scrapers have issues that need fixing');
  }

  process.exit(allSuccessful ? 0 : 1);
}

// Run tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
