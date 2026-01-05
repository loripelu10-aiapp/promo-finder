# ⚡ Quick Start - PromoFinder

## 🎯 Avvio Rapido Locale (5 minuti)

```bash
# 1. Naviga nella cartella
cd ~/Desktop/promo-finder

# 2. Installa tutto
npm install && cd backend && npm install && cd ../frontend && npm install && cd ..

# 3. Avvia in una sola riga
npm run dev
```

✅ **Frontend**: http://localhost:3000
✅ **Backend API**: http://localhost:3001

---

## 🚀 Deploy Rapido (10 minuti)

### Metodo 1️⃣: Railway + Vercel (Raccomandato)

**Backend su Railway:**
1. Vai su https://railway.app
2. Login con GitHub
3. "New Project" → "Deploy from GitHub"
4. Seleziona `promo-finder`
5. Aggiungi env: `NODE_ENV=production`
6. Copia l'URL generato (es: `https://xxx.up.railway.app`)

**Frontend su Vercel:**
1. Vai su https://vercel.com
2. "Import Project" → `promo-finder`
3. Root directory: `frontend`
4. Aggiungi env: `VITE_API_URL=<URL-RAILWAY>`
5. Deploy!

### Metodo 2️⃣: Render (All-in-One)

1. Vai su https://render.com
2. "New" → "Blueprint"
3. Seleziona `promo-finder`
4. Click "Create Services"
5. Aspetta 5-10 minuti
6. Done! 🎉

---

## 📋 Checklist Post-Deploy

- [ ] Frontend si carica correttamente
- [ ] Offerte appaiono (anche se sono fallback)
- [ ] Filtri funzionano
- [ ] Cambio lingua funziona
- [ ] Link "View Deal" aprono i siti
- [ ] Nessun errore in console

---

## 🆘 Problemi Comuni

### "Failed to fetch" nel frontend
➡️ Controlla `VITE_API_URL` nelle env variables

### Backend non parte
➡️ Controlla logs su Railway/Render dashboard

### Nessuna offerta mostrata
➡️ Normale! Gli scraper usano fallback. Le offerte reali richiedono Puppeteer.

---

## 📞 Cosa Fare Dopo

1. **Testa tutto** - Apri il sito e prova le funzionalità
2. **Condividi** - Manda il link agli amici
3. **Monitora** - Controlla i logs su Railway/Render
4. **Migliora** - Vedi TODO nel README.md

---

## 🎓 Comandi Utili

```bash
# Test API locale
curl http://localhost:3001/api/deals

# Forza refresh offerte
curl http://localhost:3001/api/deals/refresh

# Vedi statistiche
curl http://localhost:3001/api/stats

# Rebuild frontend
cd frontend && npm run build

# Deploy manuale (se auto-deploy fallisce)
git push origin main --force
```

---

## 📚 File Importanti

- `README.md` - Documentazione completa
- `DEPLOY.md` - Guida deploy dettagliata
- `backend/server.js` - API server
- `frontend/src/PromoFinder.jsx` - UI principale

---

**🎉 Buon divertimento con PromoFinder!**

Per supporto: controlla i logs o leggi la documentazione completa.
