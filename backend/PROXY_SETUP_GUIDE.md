# Proxy Setup Guide for PromoFinder

This guide explains how to configure residential proxies to bypass Adidas and other protected websites.

## Why You Need Proxies

**Sites with strong bot protection (like Adidas.com) block:**
- Datacenter IPs
- Automated browser fingerprints
- Suspicious request patterns

**Residential proxies solve this by:**
- Using real home IP addresses
- Rotating IPs to avoid rate limits
- Mimicking normal user behavior

---

## Recommended Proxy Services

### 1. Bright Data (Recommended for beginners)
- **Free Tier**: 1GB free trial
- **Pricing**: ~$8.40/GB after trial
- **Success Rate**: 95%+
- **Setup Time**: 5 minutes
- **Website**: https://brightdata.com

**Pros**:
- Easy to use
- Excellent documentation
- Best success rate
- Free trial available

**Cons**:
- Slightly expensive
- Pay-per-GB model

---

### 2. Smartproxy
- **Free Tier**: 3-day money-back guarantee
- **Pricing**: $50/month for 5GB
- **Success Rate**: 90%+
- **Setup Time**: 5 minutes
- **Website**: https://smartproxy.com

**Pros**:
- Flat monthly pricing
- Good for high volume
- Easy API

**Cons**:
- No free tier
- Minimum $50/month

---

### 3. Oxylabs
- **Free Tier**: 7-day free trial
- **Pricing**: $300/month minimum
- **Success Rate**: 98%+
- **Setup Time**: 10 minutes
- **Website**: https://oxylabs.io

**Pros**:
- Best success rate
- Enterprise grade
- Excellent support

**Cons**:
- Expensive
- Overkill for small projects

---

## Setup Instructions

### Step 1: Sign Up for Bright Data (FREE)

1. Go to https://brightdata.com
2. Click "Start Free Trial"
3. Create account (no credit card required for trial)
4. Navigate to "Proxies & Scraping Infrastructure" → "Residential Proxies"
5. Click "Get proxy"
6. Copy your proxy credentials:
   - **Host**: `brd.superproxy.io`
   - **Port**: `22225`
   - **Username**: `brd-customer-[YOUR-ID]-zone-residential_proxy1`
   - **Password**: `[YOUR-PASSWORD]`

---

### Step 2: Configure PromoFinder

Create a file: `/backend/config/proxy.config.js`

```javascript
module.exports = {
  // Bright Data configuration
  brightdata: {
    server: 'http://brd.superproxy.io:22225',
    username: 'brd-customer-[YOUR-ID]-zone-residential_proxy1',
    password: '[YOUR-PASSWORD]'
  },

  // Smartproxy configuration (alternative)
  smartproxy: {
    server: 'http://gate.smartproxy.com:7000',
    username: 'sp[YOUR-USERNAME]',
    password: '[YOUR-PASSWORD]'
  },

  // Default proxy to use
  default: 'brightdata' // or 'smartproxy'
};
```

---

### Step 3: Use Proxy in Scrapers

**Option A: Set proxy globally in orchestrator**

```javascript
const AdidasOutletFocused = require('./scrapers/brands/adidas-outlet-focused');
const proxyConfig = require('./config/proxy.config');

const scraper = new AdidasOutletFocused({
  headless: true,
  maxProducts: 20,
  proxy: proxyConfig.brightdata // Use Bright Data proxy
});

const products = await scraper.scrape();
```

**Option B: Set proxy for specific scraper instance**

```javascript
const scraper = new AdidasOutletFocused({
  headless: true,
  proxy: {
    server: 'http://brd.superproxy.io:22225',
    username: 'brd-customer-123-zone-residential_proxy1',
    password: 'your-password'
  }
});
```

---

### Step 4: Test Proxy Configuration

Run the proxy test script:

```bash
node test-adidas-with-proxy.js
```

**Expected output:**
```
🔒 Using proxy: http://brd.superproxy.io:22225
📄 Loading Adidas outlet page...
✅ Status: 200
✅ Found 24 products!
```

---

## Proxy Test Script

Create: `/backend/test-adidas-with-proxy.js`

```javascript
const AdidasOutletFocused = require('./scrapers/brands/adidas-outlet-focused');

// YOUR PROXY CREDENTIALS HERE
const proxyConfig = {
  server: 'http://brd.superproxy.io:22225',
  username: 'brd-customer-[YOUR-ID]-zone-residential_proxy1',
  password: '[YOUR-PASSWORD]'
};

async function testWithProxy() {
  console.log('🧪 Testing Adidas scraper WITH proxy...\n');

  const scraper = new AdidasOutletFocused({
    headless: true,
    maxProducts: 10,
    proxy: proxyConfig
  });

  try {
    const products = await scraper.scrape();

    if (products.length > 0) {
      console.log('\\n✅ SUCCESS! Proxy is working!');
      console.log(`📦 Found ${products.length} Adidas products`);
      console.log('\\nSample products:');
      products.slice(0, 3).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name} - $${p.salePrice} (${p.discount}% off)`);
      });
    } else {
      console.log('⚠️  Proxy connected but no products found');
      console.log('Check selectors or try different proxy region');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWithProxy();
```

---

## Troubleshooting

### Issue: "ECONNREFUSED" or "ETIMEDOUT"

**Cause**: Proxy credentials incorrect or network issues

**Fix**:
1. Verify proxy credentials in Bright Data dashboard
2. Check if your IP is whitelisted (if required)
3. Test proxy with `curl`:
   ```bash
   curl -x http://brd.superproxy.io:22225 \\
     -U "username:password" \\
     https://lumtest.com/myip.json
   ```

---

### Issue: Still getting blocked with proxy

**Cause**: Using datacenter proxy instead of residential

**Fix**:
1. Ensure you're using **residential** proxies, not datacenter
2. Enable proxy rotation in Bright Data dashboard
3. Add random delays between requests
4. Use mobile user agents

---

### Issue: "402 Payment Required"

**Cause**: Free trial expired or ran out of bandwidth

**Fix**:
1. Add payment method to Bright Data
2. Switch to pay-as-you-go plan ($8.40/GB)
3. Or try alternative proxy service (Smartproxy, Oxylabs)

---

## Cost Estimation

**For PromoFinder use case (scraping Adidas every 6 hours):**

| Activity | Data per scrape | Scrapes per day | Data per day | Monthly cost |
|----------|----------------|-----------------|--------------|--------------|
| Adidas outlet | ~10 MB | 4 | 40 MB | ~$10.08 |
| Nike + Adidas | ~20 MB | 4 | 80 MB | ~$20.16 |
| All retailers | ~50 MB | 4 | 200 MB | ~$50.40 |

**Recommendation**: Start with Bright Data free tier (1GB) to test, then evaluate costs.

---

## Alternative: Free Options (Not Recommended)

### Using Tor (Limited success)

```javascript
const scraper = new AdidasOutletFocused({
  headless: true,
  proxy: {
    server: 'socks5://127.0.0.1:9050' // Tor proxy
  }
});
```

**Pros**: Free
**Cons**:
- Slow
- Often blocked by websites
- Unreliable
- Not recommended for production

---

## Environment Variables (Recommended)

Store proxy credentials securely:

`.env`:
```bash
PROXY_SERVER=http://brd.superproxy.io:22225
PROXY_USERNAME=brd-customer-123-zone-residential_proxy1
PROXY_PASSWORD=your-secure-password
```

Load in scraper:
```javascript
require('dotenv').config();

const proxyConfig = {
  server: process.env.PROXY_SERVER,
  username: process.env.PROXY_USERNAME,
  password: process.env.PROXY_PASSWORD
};
```

---

## Summary

1. **Best for beginners**: Bright Data (1GB free trial)
2. **Best for production**: Smartproxy (flat $50/month)
3. **Best for enterprise**: Oxylabs (highest success rate)
4. **Estimated cost**: ~$10-50/month depending on usage
5. **Success rate with proxies**: 90-98% vs 0% without

**Next Steps**:
1. Sign up for Bright Data free trial
2. Copy credentials to `proxy.config.js`
3. Run `node test-adidas-with-proxy.js`
4. If successful, integrate into orchestrator
5. Monitor usage and costs
