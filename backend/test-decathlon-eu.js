const DecathlonEUScraper = require('./scrapers/eu-retailers/decathlon-eu');
const axios = require('axios');

/**
 * Validation Script for Decathlon EU Scraper
 *
 * Tests Decathlon scraper to verify:
 * - Products have real discounts (no false promotions)
 * - Images load correctly
 * - URLs are valid
 * - Discount percentages are realistic (10-70%)
 * - Only sports shoes are extracted
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

async function testDecathlonScraper() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Decathlon EU Scraper Validation Test                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const scraper = new DecathlonEUScraper({ maxProducts: 30 });

  try {
    console.log('\n⏳ Scraping sports shoes from Decathlon...');
    const products = await scraper.scrape();

    console.log(`\n📊 Results: ${products.length} products extracted`);

    if (products.length === 0) {
      console.log('❌ No products found - scraper may need debugging');
      console.log('💡 Check /tmp/decathlon-eu-debug.png to identify selectors');
      return {
        success: false,
        productCount: 0,
        validProducts: 0,
        issues: ['No products extracted']
      };
    }

    let validCount = 0;
    const allIssues = [];

    console.log('\n🔍 Validating products...\n');

    for (let i = 0; i < Math.min(products.length, 10); i++) {
      const product = products[i];
      const productIssues = [];

      console.log(`\n${i + 1}. ${product.name}`);
      console.log(`   Brand: ${product.brand}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Price: ${product.currency}${product.salePrice} (was ${product.currency}${product.originalPrice})`);
      console.log(`   Discount: ${product.discount}%`);
      console.log(`   Source: ${product.source}`);
      console.log(`   Regions: ${product.availableRegions.join(', ')}`);

      // Validate it's actually a shoe
      const nameLower = product.name.toLowerCase();
      const isShoe = nameLower.includes('shoe') ||
                    nameLower.includes('trainer') ||
                    nameLower.includes('sneaker') ||
                    nameLower.includes('boot') ||
                    nameLower.includes('running') ||
                    nameLower.includes('walking') ||
                    nameLower.includes('trail');

      if (!isShoe) {
        productIssues.push('Not a shoe product');
        console.log('   ❌ Not a shoe product');
      } else {
        console.log('   ✅ Product is footwear');
      }

      // Validate discount
      const discountCheck = validateDiscount(product);
      if (!discountCheck.valid) {
        productIssues.push(...discountCheck.issues);
        discountCheck.issues.forEach(issue => console.log(`   ${issue}`));
      } else {
        console.log('   ✅ Discount is valid and realistic');
      }

      // Validate image URL (check first 5 products)
      if (i < 5) {
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

      // Validate product URL (check first 3 products)
      if (i < 3) {
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
        console.log('   ✅ Product is FULLY VALID');
      } else {
        allIssues.push(`Product ${i + 1}: ${productIssues.join(', ')}`);
      }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📈 Decathlon EU Scraper Summary`);
    console.log('='.repeat(60));
    console.log(`Total products extracted: ${products.length}`);
    console.log(`Products validated: ${Math.min(products.length, 10)}`);
    console.log(`Valid products: ${validCount}/${Math.min(products.length, 10)}`);
    console.log(`Source: ${scraper.source}`);
    console.log(`Currency: ${scraper.currency}`);
    console.log(`Regions: ${scraper.availableRegions.join(', ')}`);

    if (allIssues.length > 0) {
      console.log(`\n⚠️  Issues found:`);
      allIssues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log(`\n✅ All validated products passed checks!`);
    }

    // Check for real discounts
    const hasRealDiscounts = products.every(p => p.originalPrice && p.salePrice && p.originalPrice > p.salePrice);
    console.log(`\n${hasRealDiscounts ? '✅' : '❌'} All products have REAL discounts (not estimated)`);

    const success = products.length > 0 && validCount > 0 && hasRealDiscounts;

    if (success) {
      console.log('\n🎉 Decathlon EU scraper passed validation!');
      console.log('✅ Ready to integrate into production');
    } else {
      console.log('\n⚠️  Scraper needs fixes before production use');
      if (!hasRealDiscounts) {
        console.log('   - Ensure only products with BOTH original and sale prices are included');
      }
    }

    return {
      success,
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
      success: false,
      productCount: 0,
      validProducts: 0,
      issues: [error.message]
    };
  }
}

// Run test
testDecathlonScraper()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
