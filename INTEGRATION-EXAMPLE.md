# Translation System Integration Examples

Quick reference for integrating the i18n system into PromoFinder components.

---

## Frontend Integration

### 1. Basic Component Translation

**Before (hardcoded English):**
```jsx
function ProductCard({ product }) {
  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <p>Was ${product.originalPrice}</p>
      <p>Now ${product.salePrice}</p>
      <button>View Deal</button>
    </div>
  );
}
```

**After (with i18n):**
```tsx
import { useTranslation } from '../i18n/useTranslation';

function ProductCard({ product }) {
  const { t } = useTranslation('common');

  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <p>{t('originalPrice')} ${product.originalPrice}</p>
      <p>${product.salePrice}</p>
      <button>{t('viewDeal')}</button>
    </div>
  );
}
```

### 2. Multiple Namespaces

```tsx
import { useTranslation } from '../i18n/useTranslation';

function ProductFilter() {
  const { t: tCommon } = useTranslation('common');
  const { t: tProducts } = useTranslation('products');

  return (
    <div>
      <h3>{tCommon('filters')}</h3>
      <button>{tProducts('category.all')}</button>
      <button>{tProducts('category.clothing')}</button>
      <button>{tProducts('category.shoes')}</button>
    </div>
  );
}
```

### 3. Language Switcher in Header

```tsx
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useTranslation } from './i18n/useTranslation';

function Header() {
  const { t } = useTranslation('common');

  return (
    <header className="header">
      <div className="logo">
        <span>{t('title')}</span>
        <span className="accent">{t('titleAccent')}</span>
      </div>
      <LanguageSwitcher />
    </header>
  );
}
```

### 4. Dynamic Content with Parameters

```tsx
import { useTranslation } from '../i18n/useTranslation';

function DealCounter({ count }) {
  const { t } = useTranslation('common');

  return (
    <p>
      <strong>{count}</strong> {t('results')}
    </p>
  );
}
```

---

## Backend Integration

### 1. Initialize Translator in server.js

**Add after existing imports:**
```javascript
const { Translator } = require('./services/translation/translator');
const { router: translationRouter, initTranslator } = require('./routes/translation');

// Initialize translator
const translator = new Translator(
  process.env.DEEPL_API_KEY,
  { url: process.env.REDIS_URL },
  {
    fallbackLanguage: 'en',
    cacheEnabled: true,
    cacheTTL: 24 * 60 * 60, // 24 hours
  }
);

async function startServer() {
  // Connect to Redis cache
  await translator.initialize();

  // Register translation routes
  initTranslator(translator);
  app.use('/api', translationRouter);

  // ... rest of server setup
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await translator.shutdown();
  process.exit(0);
});

startServer();
```

### 2. Translate Products Before Sending to Client

```javascript
// In your existing /api/deals endpoint
app.get('/api/deals', async (req, res) => {
  try {
    const { lang = 'en' } = req.query;

    // Get products from database/API
    const products = await getProducts();

    // Translate products if needed
    let translatedProducts = products;
    if (lang !== 'en') {
      translatedProducts = await Promise.all(
        products.map(async (product) => {
          const translated = await translator.translateProduct(product, lang);
          return {
            ...product,
            name: translated.name,
            description: translated.description,
          };
        })
      );
    }

    res.json({
      success: true,
      deals: translatedProducts,
      language: lang,
    });
  } catch (error) {
    console.error('Deals API error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 3. Batch Translation Example

```javascript
// Translate multiple product names at once
async function translateProductNames(products, targetLang) {
  const names = products.map(p => p.name);

  const translatedNames = await translator.batchTranslate(
    names,
    'en',
    targetLang
  );

  return products.map((product, index) => ({
    ...product,
    name: translatedNames[index],
  }));
}
```

---

## API Usage Examples

### 1. Translate Single Text

```bash
curl -X POST http://localhost:3001/api/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome to PromoFinder",
    "sourceLang": "en",
    "targetLang": "it"
  }'

# Response:
# {
#   "success": true,
#   "translation": "Benvenuto su PromoFinder",
#   "sourceLang": "en",
#   "targetLang": "it"
# }
```

### 2. Batch Translation

```bash
curl -X POST http://localhost:3001/api/translate \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["Hello", "World", "PromoFinder"],
    "sourceLang": "en",
    "targetLang": "es"
  }'

# Response:
# {
#   "success": true,
#   "translations": ["Hola", "Mundo", "PromoFinder"],
#   "count": 3
# }
```

### 3. Product Translation

```bash
curl -X POST http://localhost:3001/api/translate/product \
  -H "Content-Type: application/json" \
  -d '{
    "product": {
      "id": "123",
      "name": "Nike Running Shoes",
      "description": "Comfortable and lightweight",
      "brand": "Nike",
      "salePrice": 89.99
    },
    "targetLang": "fr"
  }'

# Response:
# {
#   "success": true,
#   "product": {
#     "id": "123",
#     "name": "Chaussures de Course Nike",
#     "description": "Confortables et légères",
#     "language": "fr"
#   }
# }
```

---

## React Component Examples

### Complete PromoFinder Component with i18n

```tsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from './i18n/useTranslation';
import { LanguageSwitcher } from './components/LanguageSwitcher';

export default function PromoFinder() {
  const { t, language } = useTranslation('common');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchDeals = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/deals?lang=${language}`
      );
      const data = await response.json();
      setProducts(data.deals || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchDeals();
  }, [language]); // Re-fetch when language changes

  return (
    <div className="promo-finder">
      <header className="header">
        <div className="logo">
          <span>{t('title')}</span>
          <span className="accent">{t('titleAccent')}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <section className="hero">
        <h1>{t('liveDeals')}</h1>
        <p>{t('subtitle')}</p>
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
        />
        <button onClick={searchDeals}>
          {t('searchButton')}
        </button>
      </section>

      <main>
        {loading && <p>{t('loading')}</p>}
        {!loading && products.length === 0 && <p>{t('noResults')}</p>}

        <div className="products-grid">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>
    </div>
  );
}

function ProductCard({ product }) {
  const { t } = useTranslation('common');

  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <div className="discount-badge">
        -{product.discount}% {t('off')}
      </div>
      <h3>{product.name}</h3>
      <p className="brand">{product.brand}</p>
      <div className="pricing">
        <span className="sale-price">€{product.salePrice}</span>
        <span className="original-price">
          {t('originalPrice')} €{product.originalPrice}
        </span>
      </div>
      <a href={product.url} target="_blank" rel="noopener noreferrer">
        {t('viewDeal')}
      </a>
    </div>
  );
}
```

---

## Testing Examples

### Frontend Testing

```tsx
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import PromoFinder from './PromoFinder';

test('renders in English by default', () => {
  render(
    <I18nextProvider i18n={i18n}>
      <PromoFinder />
    </I18nextProvider>
  );
  expect(screen.getByText('PROMO')).toBeInTheDocument();
  expect(screen.getByText('FINDER')).toBeInTheDocument();
});

test('switches to Italian', async () => {
  render(
    <I18nextProvider i18n={i18n}>
      <PromoFinder />
    </I18nextProvider>
  );

  await i18n.changeLanguage('it');

  expect(screen.getByPlaceholderText(/Cerca brand/)).toBeInTheDocument();
});
```

### Backend Testing

```typescript
import { Translator } from './services/translation/translator';

describe('Translation Service', () => {
  let translator: Translator;

  beforeAll(async () => {
    translator = new Translator(
      process.env.DEEPL_API_KEY,
      { url: process.env.REDIS_URL }
    );
    await translator.initialize();
  });

  test('translates text correctly', async () => {
    const result = await translator.translateText(
      'Hello',
      'en',
      'it'
    );
    expect(result).toBe('Ciao');
  });

  test('uses cache for repeated translations', async () => {
    // First call (uncached)
    const start1 = Date.now();
    await translator.translateText('Test', 'en', 'it');
    const time1 = Date.now() - start1;

    // Second call (cached)
    const start2 = Date.now();
    await translator.translateText('Test', 'en', 'it');
    const time2 = Date.now() - start2;

    expect(time2).toBeLessThan(time1 / 10); // 10x faster
  });
});
```

---

## Common Patterns

### 1. Error Handling with Translations

```tsx
import { useTranslation } from './i18n/useTranslation';

function ErrorDisplay({ error }) {
  const { t } = useTranslation('errors');

  const getErrorMessage = () => {
    switch (error.type) {
      case 'network':
        return t('network');
      case 'server':
        return t('server');
      case 'notFound':
        return t('notFound');
      default:
        return t('generic');
    }
  };

  return <div className="error">{getErrorMessage()}</div>;
}
```

### 2. Date/Time Localization

```tsx
import { useTranslation } from './i18n/useTranslation';

function LastUpdated({ timestamp }) {
  const { language } = useTranslation();

  const formatDate = (date) => {
    return new Intl.DateTimeFormat(language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return <p>Last updated: {formatDate(timestamp)}</p>;
}
```

### 3. Number Formatting

```tsx
function Price({ amount }) {
  const { language } = useTranslation();

  const formatPrice = (price) => {
    return new Intl.NumberFormat(language, {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  return <span>{formatPrice(amount)}</span>;
}
```

---

## Performance Tips

### 1. Preload Translations

```tsx
// In App.tsx
import { useEffect } from 'react';
import { useTranslation } from './i18n/useTranslation';

function App() {
  const { language } = useTranslation();

  useEffect(() => {
    // Preload all namespaces
    ['common', 'errors', 'products'].forEach(ns => {
      i18n.loadNamespaces(ns);
    });
  }, [language]);

  return <Router>...</Router>;
}
```

### 2. Lazy Load Translations

```tsx
import { Suspense } from 'react';

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PromoFinder />
    </Suspense>
  );
}
```

### 3. Cache Warming (Backend)

```javascript
// Warm up cache on server start
async function warmUpCache() {
  const commonPhrases = [
    'Welcome',
    'Search',
    'Filter',
    'Sort',
    'View Deal',
  ];

  const targetLangs = ['it', 'es', 'fr', 'de', 'pt'];

  for (const lang of targetLangs) {
    await translator.batchTranslate(commonPhrases, 'en', lang);
  }

  console.log('Translation cache warmed up');
}

// Call after translator.initialize()
await warmUpCache();
```

---

## Troubleshooting

### Issue: Translations not updating

**Solution:**
```bash
# Clear browser cache
localStorage.clear();

# Clear Redis cache
redis-cli FLUSHDB

# Or via API
curl -X DELETE http://localhost:3001/api/translate/cache
```

### Issue: Language not persisting

**Solution:**
```tsx
// Ensure localStorage is enabled
const { changeLanguage } = useTranslation();

const switchLanguage = async (lang) => {
  await changeLanguage(lang);
  localStorage.setItem('i18nextLng', lang); // Explicit save
};
```

### Issue: Missing translation key

**Solution:**
```tsx
// Use fallback
const { tf } = useTranslationWithFallback('common');

return <p>{tf('missingKey', 'Default Text')}</p>;
```

---

**For full documentation, see:** `README-i18n.md`
