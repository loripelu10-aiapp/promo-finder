/**
 * Find Uniqlo sale page URLs
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function findSaleUrls() {
  console.log('Finding Uniqlo sale URLs...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.setViewport({ width: 1920, height: 1080 });

  // Try various potential sale URLs
  const urlsToTry = [
    'https://www.uniqlo.com/us/en/',
    'https://www.uniqlo.com/us/en/women/sale',
    'https://www.uniqlo.com/us/en/men/sale',
    'https://www.uniqlo.com/us/en/kids/sale',
    'https://www.uniqlo.com/us/en/special-offers',
    'https://www.uniqlo.com/us/en/spl/sale',
    'https://www.uniqlo.com/us/en/feature/sale',
    'https://www.uniqlo.com/us/en/c/sale',
    'https://www.uniqlo.com/us/en/category/sale',
  ];

  for (const url of urlsToTry) {
    console.log(`\nTrying: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      const finalUrl = page.url();
      const title = await page.title();
      console.log(`  Final URL: ${finalUrl}`);
      console.log(`  Title: ${title}`);

      if (!finalUrl.includes('not-found') && !title.toLowerCase().includes('error')) {
        // Check for product links
        const productLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a')).filter(a =>
            a.href.includes('/products/') ||
            a.href.includes('/E') ||
            (a.className && a.className.includes('product'))
          );
          return links.slice(0, 5).map(a => ({ href: a.href, text: a.textContent?.substring(0, 50) }));
        });

        if (productLinks.length > 0) {
          console.log(`  Found ${productLinks.length} product links!`);
          productLinks.forEach(l => console.log(`    - ${l.href}`));
        }

        // Check for sale-related navigation
        const saleLinks = await page.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll('a'));
          return allLinks
            .filter(a => {
              const text = (a.textContent || '').toLowerCase();
              const href = (a.href || '').toLowerCase();
              return text.includes('sale') ||
                     text.includes('clearance') ||
                     text.includes('deals') ||
                     text.includes('limited') ||
                     text.includes('offer') ||
                     text.includes('promo') ||
                     href.includes('sale') ||
                     href.includes('clearance') ||
                     href.includes('limited');
            })
            .map(a => ({ href: a.href, text: a.textContent?.trim().substring(0, 50) }))
            .filter(l => l.href && l.href.startsWith('http'));
        });

        if (saleLinks.length > 0) {
          console.log(`\n  Sale-related links found:`);
          const uniqueLinks = [...new Map(saleLinks.map(l => [l.href, l])).values()];
          uniqueLinks.slice(0, 10).forEach(l => console.log(`    - ${l.href} "${l.text}"`));
        }
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }

  // Now let's look at the homepage navigation specifically
  console.log('\n\n=== Checking homepage navigation ===');
  await page.goto('https://www.uniqlo.com/us/en/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Look for nav items
  const navItems = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a, button'));
    return allLinks
      .filter(el => {
        const text = (el.textContent || '').toLowerCase();
        return text.includes('sale') ||
               text.includes('women') ||
               text.includes('men') ||
               text.includes('kids') ||
               text.includes('shop');
      })
      .map(el => ({
        tag: el.tagName,
        href: el.href || '',
        text: el.textContent?.trim().substring(0, 50)
      }))
      .slice(0, 20);
  });

  console.log('Navigation items:');
  navItems.forEach(n => console.log(`  ${n.tag}: ${n.href || '(no href)'} - "${n.text}"`));

  await browser.close();
}

findSaleUrls().catch(console.error);
