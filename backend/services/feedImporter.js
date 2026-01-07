/**
 * Feed Importer Service
 * Importa e processa Product Feeds da network affiliati (Awin, TradeDoubler)
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const xml2js = require('xml2js');
const axios = require('axios');

const PRODUCTS_FILE = path.join(__dirname, '../data/products.json');
const FEEDS_DIR = path.join(__dirname, '../data/feeds');
const MERCHANTS_CONFIG = require('../config/merchants.json');

/**
 * Normalizza un prodotto dal feed Awin alla struttura unificata
 */
function normalizeAwinProduct(row, merchantConfig) {
  const originalPrice = parseFloat(row.rrp_price) || parseFloat(row.search_price);
  const salePrice = parseFloat(row.search_price);
  const discount = row.savings_percent ? parseInt(row.savings_percent) : 
    Math.round((1 - salePrice / originalPrice) * 100);

  return {
    id: `${merchantConfig.id}-${row.aw_product_id || row.merchant_product_id}`,
    externalId: row.aw_product_id || row.merchant_product_id,
    name: row.product_name,
    brand: row.brand_name || merchantConfig.name,
    merchant: merchantConfig.id,
    merchantName: merchantConfig.name,
    merchantLogo: merchantConfig.logo,
    merchantColor: merchantConfig.color,
    originalPrice: originalPrice,
    salePrice: salePrice,
    discount: discount,
    currency: row.currency || 'EUR',
    image: row.merchant_image_url || row.aw_image_url,
    affiliateUrl: row.aw_deep_link,
    originalUrl: row.merchant_deep_link || extractOriginalUrl(row.aw_deep_link),
    category: detectCategory(row.product_name, row.category_name),
    inStock: row.in_stock === '1' || row.in_stock === 'true' || row.in_stock === true,
    commission: merchantConfig.commission,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Estrae URL originale dal deeplink Awin
 */
function extractOriginalUrl(deeplink) {
  if (!deeplink) return null;
  try {
    const match = deeplink.match(/ued=([^&]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  } catch (e) {}
  return null;
}

/**
 * Rileva categoria dal nome prodotto e categoria originale
 */
function detectCategory(productName, originalCategory) {
  const name = (productName || '').toLowerCase();
  const cat = (originalCategory || '').toLowerCase();
  const combined = `${name} ${cat}`;
  
  for (const [category, config] of Object.entries(MERCHANTS_CONFIG.categories)) {
    for (const keyword of config.keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  
  return 'clothing'; // default
}

/**
 * Parse CSV feed
 */
async function parseCSVFeed(filePath) {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Parse XML feed
 */
async function parseXMLFeed(filePath) {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });
    
    parser.parseString(fileContent, (err, result) => {
      if (err) {
        reject(err);
      } else {
        // Adatta in base alla struttura XML del feed
        const products = result.products?.product || result.feed?.entry || [];
        resolve(Array.isArray(products) ? products : [products]);
      }
    });
  });
}

/**
 * Scarica feed da URL remoto
 */
async function downloadFeed(url, outputPath) {
  try {
    console.log(`📥 Downloading feed from: ${url}`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'PromoFinder/1.0 Feed Importer'
      }
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Feed saved to: ${outputPath}`);
        resolve(outputPath);
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`❌ Failed to download feed: ${error.message}`);
    throw error;
  }
}

/**
 * Importa feed da file locale
 */
async function importFeedFromFile(filePath, merchantId) {
  const merchantConfig = MERCHANTS_CONFIG.merchants.find(m => m.id === merchantId);
  
  if (!merchantConfig) {
    throw new Error(`Merchant not found: ${merchantId}`);
  }

  console.log(`📂 Importing feed for ${merchantConfig.name} from ${filePath}`);
  
  const ext = path.extname(filePath).toLowerCase();
  let rawProducts;
  
  if (ext === '.csv') {
    rawProducts = await parseCSVFeed(filePath);
  } else if (ext === '.xml') {
    rawProducts = await parseXMLFeed(filePath);
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  console.log(`📊 Found ${rawProducts.length} raw products`);

  // Normalizza e filtra
  const products = rawProducts
    .map(row => normalizeAwinProduct(row, merchantConfig))
    .filter(p => {
      // Solo prodotti validi
      if (!p.name || !p.salePrice) return false;
      // Solo prodotti in sconto
      if (p.discount < 10) return false;
      // Solo prodotti con immagine
      if (!p.image) return false;
      // Solo prodotti in stock
      if (!p.inStock) return false;
      return true;
    });

  console.log(`✅ Imported ${products.length} valid products from ${merchantConfig.name}`);
  
  return products;
}

/**
 * Importa tutti i feed configurati
 */
async function importAllFeeds() {
  console.log('🚀 Starting feed import...');
  
  let allProducts = [];
  
  // Carica prodotti esistenti per merge
  if (fs.existsSync(PRODUCTS_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
      allProducts = existing.products || [];
    } catch (e) {}
  }

  // Trova tutti i file feed nella cartella
  if (fs.existsSync(FEEDS_DIR)) {
    const feedFiles = fs.readdirSync(FEEDS_DIR).filter(f => 
      f.endsWith('.csv') || f.endsWith('.xml')
    );

    for (const feedFile of feedFiles) {
      try {
        // Estrai merchant ID dal nome file (es: "awin_zalando.csv" -> "zalando")
        const merchantId = feedFile.replace(/^(awin_|tradedoubler_|amazon_)/, '').replace(/\.(csv|xml)$/, '');
        const filePath = path.join(FEEDS_DIR, feedFile);
        
        const products = await importFeedFromFile(filePath, merchantId);
        
        // Rimuovi prodotti vecchi dello stesso merchant
        allProducts = allProducts.filter(p => p.merchant !== merchantId);
        
        // Aggiungi nuovi
        allProducts = [...allProducts, ...products];
        
      } catch (error) {
        console.error(`❌ Error importing ${feedFile}:`, error.message);
      }
    }
  }

  // Salva prodotti unificati
  const output = {
    lastUpdated: new Date().toISOString(),
    totalProducts: allProducts.length,
    products: allProducts
  };

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✅ Total products saved: ${allProducts.length}`);
  console.log(`📁 Output: ${PRODUCTS_FILE}`);
  
  return output;
}

/**
 * Aggiungi prodotto manualmente
 */
function addManualProduct(productData) {
  let data = { products: [], lastUpdated: new Date().toISOString() };
  
  if (fs.existsSync(PRODUCTS_FILE)) {
    data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  }

  const merchantConfig = MERCHANTS_CONFIG.merchants.find(m => m.id === productData.merchant);
  
  const newProduct = {
    id: `manual-${Date.now()}`,
    ...productData,
    merchantName: merchantConfig?.name || productData.merchant,
    merchantLogo: merchantConfig?.logo || '',
    merchantColor: merchantConfig?.color || '#000',
    commission: merchantConfig?.commission || '5%',
    lastUpdated: new Date().toISOString()
  };

  data.products.push(newProduct);
  data.totalProducts = data.products.length;
  data.lastUpdated = new Date().toISOString();

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(data, null, 2));
  
  return newProduct;
}

/**
 * Genera link affiliato da URL originale
 */
function generateAffiliateLink(originalUrl, merchantId, affiliateId) {
  const merchantConfig = MERCHANTS_CONFIG.merchants.find(m => m.id === merchantId);
  
  if (!merchantConfig) {
    return originalUrl;
  }

  if (merchantConfig.network === 'awin') {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `https://www.awin1.com/cread.php?awinmid=${merchantConfig.merchantId}&awinaffid=${affiliateId}&ued=${encodedUrl}`;
  }

  if (merchantConfig.network === 'tradedoubler') {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `https://clk.tradedoubler.com/click?p=${merchantConfig.programId}&a=${affiliateId}&url=${encodedUrl}`;
  }

  if (merchantConfig.network === 'amazon') {
    // Aggiungi tag Amazon
    const tag = MERCHANTS_CONFIG.networks.amazon.tag;
    if (originalUrl.includes('?')) {
      return `${originalUrl}&tag=${tag}`;
    }
    return `${originalUrl}?tag=${tag}`;
  }

  return originalUrl;
}

// Export
module.exports = {
  importFeedFromFile,
  importAllFeeds,
  addManualProduct,
  generateAffiliateLink,
  parseCSVFeed,
  parseXMLFeed,
  downloadFeed,
  PRODUCTS_FILE,
  FEEDS_DIR
};

// Run directly
if (require.main === module) {
  importAllFeeds()
    .then(() => console.log('\n🎉 Feed import completed!'))
    .catch(err => console.error('❌ Import failed:', err));
}
