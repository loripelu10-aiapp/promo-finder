import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as fs from "fs";

puppeteer.use(StealthPlugin());

interface DSWProduct {
  name: string;
  originalPrice: number;
  salePrice: number;
  discount: number;
  imageUrl: string;
  productUrl: string;
}

async function scrapeDSWSale(): Promise<DSWProduct[]> {
  console.log("Starting DSW sale scraper...");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920x1080",
    ],
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  });

  const allProducts: DSWProduct[] = [];
  const seenUrls = new Set<string>();

  try {
    console.log("Navigating to DSW sale page...");
    await page.goto("https://www.dsw.com/en/us/sale", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Wait for products to load
    await page.waitForSelector('[class*="product"], [class*="Product"], [data-testid*="product"]', {
      timeout: 30000,
    }).catch(() => console.log("Waiting for alternative selectors..."));

    // Add delay to let dynamic content load
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Function to extract products from current page state
    async function extractProducts(): Promise<DSWProduct[]> {
      return page.evaluate(() => {
        const products: DSWProduct[] = [];

        // Try multiple selector strategies for DSW
        const productSelectors = [
          '[data-testid="product-tile"]',
          '[class*="ProductTile"]',
          '[class*="product-tile"]',
          '[class*="ProductCard"]',
          'article[class*="product"]',
          '.product-listing-item',
          '[class*="productCard"]',
          'div[data-automation-id*="product"]',
          'li[class*="product"]',
          '[class*="plp-product"]',
        ];

        let productElements: Element[] = [];

        for (const selector of productSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} products with selector: ${selector}`);
            productElements = Array.from(elements);
            break;
          }
        }

        // If no specific product containers found, try to find price patterns
        if (productElements.length === 0) {
          // Look for elements with both original and sale prices
          const priceContainers = document.querySelectorAll('[class*="price"], [class*="Price"]');
          console.log(`Found ${priceContainers.length} price containers`);
        }

        productElements.forEach((el) => {
          try {
            // Get product name
            const nameSelectors = [
              '[class*="productName"]',
              '[class*="ProductName"]',
              '[class*="product-name"]',
              '[class*="title"]',
              '[class*="Title"]',
              'h3',
              'h2',
              '[data-testid*="name"]',
              'a[class*="product"]',
            ];

            let name = "";
            for (const sel of nameSelectors) {
              const nameEl = el.querySelector(sel);
              if (nameEl?.textContent?.trim()) {
                name = nameEl.textContent.trim();
                break;
              }
            }

            // Get prices - look for original/was price and sale/now price
            const priceText = el.textContent || "";
            const priceMatches = priceText.match(/\$[\d,.]+/g) || [];

            let originalPrice = 0;
            let salePrice = 0;

            // Try specific price selectors
            const originalPriceSelectors = [
              '[class*="originalPrice"]',
              '[class*="OriginalPrice"]',
              '[class*="was-price"]',
              '[class*="WasPrice"]',
              '[class*="msrp"]',
              '[class*="strikethrough"]',
              'del',
              's',
              '[class*="compare-price"]',
              '[class*="regular-price"]',
            ];

            const salePriceSelectors = [
              '[class*="salePrice"]',
              '[class*="SalePrice"]',
              '[class*="now-price"]',
              '[class*="NowPrice"]',
              '[class*="current-price"]',
              '[class*="final-price"]',
              '[class*="discount-price"]',
            ];

            for (const sel of originalPriceSelectors) {
              const priceEl = el.querySelector(sel);
              if (priceEl?.textContent) {
                const match = priceEl.textContent.match(/\$?([\d,.]+)/);
                if (match) {
                  originalPrice = parseFloat(match[1].replace(",", ""));
                  break;
                }
              }
            }

            for (const sel of salePriceSelectors) {
              const priceEl = el.querySelector(sel);
              if (priceEl?.textContent) {
                const match = priceEl.textContent.match(/\$?([\d,.]+)/);
                if (match) {
                  salePrice = parseFloat(match[1].replace(",", ""));
                  break;
                }
              }
            }

            // If we couldn't find specific price elements, parse from matched prices
            if (originalPrice === 0 && salePrice === 0 && priceMatches.length >= 2) {
              const prices = priceMatches
                .map((p) => parseFloat(p.replace(/[$,]/g, "")))
                .filter((p) => !isNaN(p) && p > 0)
                .sort((a, b) => b - a);

              if (prices.length >= 2) {
                originalPrice = prices[0];
                salePrice = prices[1];
              }
            }

            // Get image URL
            const imgSelectors = [
              'img[class*="product"]',
              'img[class*="Product"]',
              'img[src*="dsw"]',
              'img[data-src*="dsw"]',
              "img",
            ];

            let imageUrl = "";
            for (const sel of imgSelectors) {
              const imgEl = el.querySelector(sel) as HTMLImageElement;
              if (imgEl) {
                imageUrl =
                  imgEl.src ||
                  imgEl.dataset.src ||
                  imgEl.getAttribute("data-lazy-src") ||
                  "";
                if (imageUrl && (imageUrl.includes("dsw") || imageUrl.includes("scene7"))) {
                  break;
                }
              }
            }

            // Get product URL
            const linkSelectors = ['a[href*="/product/"]', 'a[href*="dsw.com"]', "a"];

            let productUrl = "";
            for (const sel of linkSelectors) {
              const linkEl = el.querySelector(sel) as HTMLAnchorElement;
              if (linkEl?.href) {
                productUrl = linkEl.href;
                if (productUrl.includes("/product/") || productUrl.includes("dsw.com")) {
                  break;
                }
              }
            }

            // Only add if we have valid data with a real discount
            if (
              name &&
              originalPrice > 0 &&
              salePrice > 0 &&
              salePrice < originalPrice &&
              productUrl
            ) {
              const discount = Math.round(
                ((originalPrice - salePrice) / originalPrice) * 100
              );
              products.push({
                name,
                originalPrice,
                salePrice,
                discount,
                imageUrl,
                productUrl,
              });
            }
          } catch (err) {
            // Skip this product
          }
        });

        return products;
      });
    }

    // Try to scroll and load more products
    async function scrollAndLoadMore(maxScrolls: number = 20): Promise<void> {
      for (let i = 0; i < maxScrolls; i++) {
        console.log(`Scroll ${i + 1}/${maxScrolls}...`);

        // Scroll down
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 2);
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Click "Load More" button if present
        const loadMoreSelectors = [
          'button[class*="loadMore"]',
          'button[class*="LoadMore"]',
          'button[class*="load-more"]',
          '[data-testid*="load-more"]',
          'button:contains("Load More")',
          'button:contains("Show More")',
          'a[class*="load-more"]',
        ];

        for (const sel of loadMoreSelectors) {
          try {
            const button = await page.$(sel);
            if (button) {
              await button.click();
              console.log("Clicked load more button");
              await new Promise((resolve) => setTimeout(resolve, 3000));
              break;
            }
          } catch {
            // Button not found or not clickable
          }
        }

        // Extract products after each scroll
        const currentProducts = await extractProducts();
        for (const product of currentProducts) {
          if (!seenUrls.has(product.productUrl)) {
            seenUrls.add(product.productUrl);
            allProducts.push(product);
          }
        }

        console.log(`Total unique products found: ${allProducts.length}`);

        if (allProducts.length >= 150) {
          console.log("Reached target product count");
          break;
        }
      }
    }

    // Initial extraction
    const initialProducts = await extractProducts();
    for (const product of initialProducts) {
      if (!seenUrls.has(product.productUrl)) {
        seenUrls.add(product.productUrl);
        allProducts.push(product);
      }
    }
    console.log(`Initial products found: ${allProducts.length}`);

    // If initial extraction didn't work, try alternative approach
    if (allProducts.length === 0) {
      console.log("Trying alternative extraction approach...");

      // Take a screenshot for debugging
      await page.screenshot({ path: "/tmp/dsw-debug.png", fullPage: false });
      console.log("Debug screenshot saved to /tmp/dsw-debug.png");

      // Get page HTML for analysis
      const pageContent = await page.content();
      console.log("Page title:", await page.title());
      console.log("Page URL:", page.url());

      // Try to find product data in JSON
      const jsonProducts = await page.evaluate(() => {
        // Look for product data in window object or scripts
        const scripts = document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]');
        const data: any[] = [];

        scripts.forEach((script) => {
          try {
            const parsed = JSON.parse(script.textContent || "");
            if (parsed) data.push(parsed);
          } catch {
            // Not valid JSON
          }
        });

        // Also check for __NEXT_DATA__ or similar
        const nextData = (window as any).__NEXT_DATA__;
        if (nextData) data.push(nextData);

        const nuxtData = (window as any).__NUXT__;
        if (nuxtData) data.push(nuxtData);

        return data;
      });

      console.log("Found JSON data sources:", jsonProducts.length);
    }

    // Scroll to load more
    await scrollAndLoadMore(25);

    // Try navigating through pagination if available
    if (allProducts.length < 100) {
      console.log("Trying pagination...");
      for (let pageNum = 2; pageNum <= 5; pageNum++) {
        try {
          const paginatedUrl = `https://www.dsw.com/en/us/sale?page=${pageNum}`;
          console.log(`Navigating to page ${pageNum}...`);
          await page.goto(paginatedUrl, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });
          await new Promise((resolve) => setTimeout(resolve, 3000));

          const pageProducts = await extractProducts();
          for (const product of pageProducts) {
            if (!seenUrls.has(product.productUrl)) {
              seenUrls.add(product.productUrl);
              allProducts.push(product);
            }
          }
          console.log(`After page ${pageNum}: ${allProducts.length} products`);

          if (allProducts.length >= 100) break;
        } catch (err) {
          console.log(`Error on page ${pageNum}:`, err);
        }
      }
    }

    // Try category sub-pages for more products
    if (allProducts.length < 100) {
      const categories = [
        "/en/us/sale/womens-sale-shoes",
        "/en/us/sale/mens-sale-shoes",
        "/en/us/sale/kids-sale-shoes",
        "/en/us/c/womens-shoes/clearance",
        "/en/us/c/mens-shoes/clearance",
      ];

      for (const category of categories) {
        try {
          console.log(`Trying category: ${category}`);
          await page.goto(`https://www.dsw.com${category}`, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Scroll a bit
          for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }

          const categoryProducts = await extractProducts();
          for (const product of categoryProducts) {
            if (!seenUrls.has(product.productUrl)) {
              seenUrls.add(product.productUrl);
              allProducts.push(product);
            }
          }
          console.log(`After ${category}: ${allProducts.length} products`);

          if (allProducts.length >= 150) break;
        } catch (err) {
          console.log(`Error on category ${category}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }

  // Filter for DSW CDN images and clean up data
  const filteredProducts = allProducts
    .filter((p) => {
      // Ensure image is from DSW CDN
      const validImage =
        !p.imageUrl ||
        p.imageUrl.includes("dsw") ||
        p.imageUrl.includes("scene7") ||
        p.imageUrl.includes("images.dsw.com");
      return validImage && p.discount > 0;
    })
    .map((p) => ({
      ...p,
      // Ensure product URL is absolute
      productUrl: p.productUrl.startsWith("http")
        ? p.productUrl
        : `https://www.dsw.com${p.productUrl}`,
    }));

  console.log(`\nFinal count: ${filteredProducts.length} products with valid discounts`);

  return filteredProducts;
}

async function main() {
  try {
    const products = await scrapeDSWSale();

    // Save to file
    const outputPath = "/tmp/dsw-products.json";
    fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
    console.log(`\nSaved ${products.length} products to ${outputPath}`);

    // Print summary
    if (products.length > 0) {
      console.log("\n=== Sample Products ===");
      products.slice(0, 5).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Original: $${p.originalPrice.toFixed(2)}`);
        console.log(`   Sale: $${p.salePrice.toFixed(2)}`);
        console.log(`   Discount: ${p.discount}%`);
        console.log(`   URL: ${p.productUrl}`);
      });

      // Statistics
      const avgDiscount =
        products.reduce((sum, p) => sum + p.discount, 0) / products.length;
      const maxDiscount = Math.max(...products.map((p) => p.discount));
      console.log("\n=== Statistics ===");
      console.log(`Total products: ${products.length}`);
      console.log(`Average discount: ${avgDiscount.toFixed(1)}%`);
      console.log(`Max discount: ${maxDiscount}%`);
    }
  } catch (error) {
    console.error("Failed to scrape DSW:", error);
    process.exit(1);
  }
}

main();
