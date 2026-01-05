# 🛍️ PromoFinder - Fashion Deals Aggregator

Real-time fashion deals aggregator che scrappa offerte da Zalando, ASOS, H&M e altri brand.

## 🚀 Features

- ✅ **Scraping in tempo reale** da multiple fonti (Zalando, ASOS, H&M)
- ✅ **API REST** per accedere alle offerte
- ✅ **Filtri avanzati**: categoria, prezzo, sconto minimo, brand, ricerca
- ✅ **Multilingua**: EN, IT, ES, FR, DE, PT
- ✅ **Cache intelligente**: file JSON locale (no database)
- ✅ **Auto-refresh**: cron job ogni 2 ore
- ✅ **UI moderna**: React con design minimale dark theme

## 📁 Struttura Progetto

```
promo-finder/
├── backend/
│   ├── scrapers/         # Scraper per ogni sito
│   │   ├── zalando.js
│   │   ├── asos.js
│   │   └── hm.js
│   ├── cache/            # Cache JSON locale
│   ├── server.js         # Express server
│   ├── cron.js           # Scheduled jobs
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── PromoFinder.jsx  # Main component
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── railway.json          # Railway deploy config
├── render.yaml           # Render deploy config
└── README.md
```

## 🔧 Setup Locale

### 1. Installa dipendenze

```bash
# Root
npm install

# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### 2. Configura environment variables

**Backend** (`backend/.env`):
```env
PORT=3001
NODE_ENV=development
API_URL=http://localhost:3001
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3001
```

### 3. Avvia in locale

```bash
# Opzione 1: Tutto insieme (dalla root)
npm run dev

# Opzione 2: Separatamente
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 4. Testa l'applicazione

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/

## 📡 API Endpoints

### `GET /api/deals`

Ottieni tutte le offerte con filtri opzionali.

**Query Parameters:**
- `category` - Filtra per categoria: `all|clothing|shoes|accessories`
- `minDiscount` - Sconto minimo in percentuale (es: `30`)
- `maxPrice` - Prezzo massimo (es: `100`)
- `brand` - Filtra per brand (es: `Nike`)
- `search` - Ricerca testuale
- `sortBy` - Ordina per: `relevance|priceLow|priceHigh|discountHigh|newest`

**Esempio:**
```bash
curl "http://localhost:3001/api/deals?category=shoes&minDiscount=30&maxPrice=100"
```

**Response:**
```json
{
  "success": true,
  "count": 15,
  "lastUpdated": "2026-01-05T21:00:00.000Z",
  "deals": [
    {
      "id": "zalando-123",
      "brand": "Nike",
      "name": "Air Max 90",
      "category": "shoes",
      "originalPrice": 140,
      "salePrice": 89.99,
      "discount": 36,
      "image": "https://...",
      "source": "zalando.com",
      "url": "https://...",
      "isNew": true,
      "scrapedAt": "2026-01-05T21:00:00.000Z"
    }
  ]
}
```

### `GET /api/deals/refresh`

Forza il refresh manuale delle offerte.

```bash
curl http://localhost:3001/api/deals/refresh
```

### `GET /api/stats`

Ottieni statistiche sulle offerte.

```bash
curl http://localhost:3001/api/stats
```

## 🚢 Deploy

### Opzione 1: Railway.app (Consigliato)

1. **Crea account su [Railway.app](https://railway.app)**

2. **Collega il repository GitHub**
   ```bash
   cd promo-finder
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create promo-finder --public --source=. --push
   ```

3. **Deploy su Railway**
   - Vai su railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Seleziona il tuo repository
   - Railway detecterà automaticamente il `railway.json`
   - Aggiungi variabili ambiente:
     - `NODE_ENV=production`
     - `PORT=3001` (auto-settato)

4. **Ottieni l'URL del backend**
   - Railway ti darà un URL tipo: `https://promo-finder-production.up.railway.app`

5. **Deploy frontend (Vercel/Netlify)**
   - Vai su [Vercel](https://vercel.com) o [Netlify](https://netlify.com)
   - Importa il repository
   - Setta:
     - **Build Command**: `cd frontend && npm run build`
     - **Output Directory**: `frontend/dist`
     - **Environment Variable**: `VITE_API_URL=https://TUO-BACKEND-URL`

### Opzione 2: Render.com

1. **Crea account su [Render.com](https://render.com)**

2. **Deploy con render.yaml**
   - Vai su Render Dashboard
   - Click "New" → "Blueprint"
   - Collega il repository
   - Render userà automaticamente `render.yaml`
   - Deploya backend e frontend insieme

3. **Configure environment variables** (se necessario):
   - Backend: `NODE_ENV=production`
   - Frontend: `VITE_API_URL` verrà settato automaticamente dal service link

## 🔐 Environment Variables (Production)

### Backend
```env
NODE_ENV=production
PORT=10000  # O qualsiasi porta assegnata dal provider
```

### Frontend
```env
VITE_API_URL=https://your-backend-url.com
```

## 🛠️ Troubleshooting

### Gli scraper non funzionano

I siti con protezioni anti-bot (Cloudflare, etc.) bloccheranno gli scraper Cheerio. L'app usa **fallback products** per garantire che funzioni sempre. Per scraping reale, considera:

1. **Puppeteer** (più pesante ma bypassa molte protezioni)
2. **Proxy rotanti**
3. **API ufficiali** dei brand (se disponibili)

### CORS errors

Assicurati che il backend abbia CORS abilitato:
```javascript
// backend/server.js
app.use(cors());
```

### Cache non si aggiorna

Forza il refresh manuale:
```bash
curl http://localhost:3001/api/deals/refresh
```

O elimina la cache:
```bash
rm backend/cache/deals.json
```

## 📝 TODO Future

- [ ] Aggiungere Puppeteer per siti con protezioni avanzate
- [ ] Implementare Redis per cache distribuita
- [ ] Aggiungere più brand (Zara, Mango, Nike, Uniqlo)
- [ ] Sistema di notifiche per offerte hot
- [ ] Filtri per taglia/colore
- [ ] Comparazione prezzi storici
- [ ] User accounts e wishlist

## 📄 License

MIT

## 👤 Author

Creato con ❤️ usando Claude Code

---

**⚡ Quick Start:**
```bash
# Clone
git clone <your-repo>
cd promo-finder

# Install
npm run install-all

# Run
npm run dev

# Deploy
git push origin main
# Then connect to Railway/Render
```

🎉 **App live**: [Your deployed URL here]
