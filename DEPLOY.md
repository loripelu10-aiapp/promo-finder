# 🚀 Guida Deploy Rapido - PromoFinder

## ✅ Repository Creato

📦 **GitHub**: https://github.com/loripelu10-aiapp/promo-finder

---

## 🎯 Opzione 1: Railway.app (Backend) + Vercel (Frontend)

### Step 1: Deploy Backend su Railway

1. **Vai su [Railway.app](https://railway.app)** e accedi con GitHub

2. **New Project** → **Deploy from GitHub repo**

3. **Seleziona il repository**: `loripelu10-aiapp/promo-finder`

4. **Configura il progetto**:
   - Railway detecterà automaticamente `railway.json`
   - Root Directory: lascia vuoto (userà la root)

5. **Environment Variables** (aggiungi in Settings):
   ```
   NODE_ENV=production
   ```

   (PORT viene settato automaticamente da Railway)

6. **Deploy** → Railway compilerà e deployerà il backend

7. **Ottieni l'URL**:
   - Vai in Settings → Domains
   - Genera un dominio: `promo-finder-production.up.railway.app`
   - **COPIA QUESTO URL** (lo userai per il frontend)

### Step 2: Deploy Frontend su Vercel

1. **Vai su [Vercel.com](https://vercel.com)** e accedi con GitHub

2. **Import Project** → Seleziona `loripelu10-aiapp/promo-finder`

3. **Configure Project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. **Environment Variables**:
   ```
   VITE_API_URL=https://promo-finder-production.up.railway.app
   ```
   (Usa l'URL del backend di Railway dello Step 1.7)

5. **Deploy** → Vercel compilerà e deployerà il frontend

6. **Ottieni l'URL finale**:
   - Vercel ti darà un URL tipo: `https://promo-finder-xyz.vercel.app`
   - **QUESTO È IL TUO SITO LIVE! 🎉**

---

## 🎯 Opzione 2: Render.com (All-in-One)

### Deploy con Render Blueprint

1. **Vai su [Render.com](https://render.com)** e accedi con GitHub

2. **New** → **Blueprints**

3. **Connect repository**: Seleziona `loripelu10-aiapp/promo-finder`

4. **Nome Blueprint**: `promo-finder`

5. **Review** → Render creerà automaticamente:
   - Backend service (da `render.yaml`)
   - Frontend static site (da `render.yaml`)

6. **Environment Variables** (già configurate in `render.yaml`):
   - Backend: `NODE_ENV=production`, `PORT=10000`
   - Frontend: `VITE_API_URL` viene collegato automaticamente

7. **Create Services** → Render deployerà tutto

8. **Aspetta 5-10 minuti** per il primo build

9. **Ottieni gli URL**:
   - Backend: `https://promo-finder-api.onrender.com`
   - Frontend: `https://promo-finder-frontend.onrender.com`
   - **IL FRONTEND È IL TUO SITO LIVE! 🎉**

---

## ⚠️ Note Importanti

### Railway (Free Tier)
- ✅ 500 ore/mese di runtime
- ✅ Ideale per backend API
- ⚠️ Dorme dopo inattività (cold start ~30s)

### Vercel (Free Tier)
- ✅ Hosting static illimitato
- ✅ Deploy automatici da GitHub
- ✅ CDN globale velocissimo
- ✅ SSL/HTTPS automatico

### Render (Free Tier)
- ✅ 750 ore/mese di runtime
- ✅ Deploy automatici da GitHub
- ⚠️ Dorme dopo 15min inattività (cold start ~1min)
- ⚠️ Build più lento di Railway

---

## 🔧 Troubleshooting

### Backend non risponde
1. Controlla i logs su Railway/Render
2. Verifica che `NODE_ENV=production` sia settato
3. Controlla che la porta sia corretta (Railway auto-assegna)

### Frontend mostra errori API
1. Verifica che `VITE_API_URL` punti al backend corretto
2. Controlla CORS: backend deve avere `app.use(cors())`
3. Apri la console del browser per vedere gli errori

### Cache non funziona
1. Su Railway/Render, la cache JSON è effimera
2. Considera di aggiungere Redis (Railway offre plugin gratuito)
3. Per ora, la cache si re-popola automaticamente

---

## 📊 Monitoraggio

### Railway
- Dashboard → Metrics per vedere CPU/RAM usage
- Logs tab per vedere output console

### Render
- Dashboard → Events per vedere deploy history
- Logs per vedere output applicazione

---

## 🎉 Deploy Completato!

Una volta deployato, testa il sito:

1. **Visita il frontend URL**
2. **Controlla che le offerte si carichino**
3. **Testa i filtri** (categoria, prezzo, sconto)
4. **Cambia lingua** per verificare traduzioni
5. **Prova la ricerca**

Se tutto funziona: **COMPLIMENTI! 🚀**

---

## 🔄 Aggiornamenti Futuri

Ogni volta che fai modifiche:

```bash
git add .
git commit -m "Descrizione modifiche"
git push origin main
```

Railway/Vercel/Render deployanno automaticamente le modifiche!

---

## 💡 Tips

- **Custom Domain**: Aggiungi un dominio personalizzato da Railway/Vercel settings
- **Monitoring**: Usa Railway/Render dashboard per monitorare uptime
- **Logs**: Controlla sempre i logs in caso di problemi
- **Backup**: GitHub è il tuo backup - committa spesso!

---

**Need help?** Controlla README.md per documentazione completa.
