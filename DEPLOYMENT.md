# 🚀 Deployment Guide - MangaVerse

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────┐
│            User's Browser                   │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────┐
│  Frontend (Next.js)                          │
│  🔗 Vercel                                   │
│  https://manga-verse.vercel.app              │
└──────────────┬───────────────────────────────┘
               │ API Calls
               ↓
┌──────────────────────────────────────────────┐
│  Backend (Express + Crawler)                 │
│  🚂 Railway / Render / Heroku                │
│  https://manga-verse-api.railway.app         │
└──────────────┬───────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────┐
│  MongoDB Atlas (Database)                    │
│  🍃 Cloud MongoDB                            │
└──────────────────────────────────────────────┘
```

## 🎯 Deployment Steps

### Part 1: Deploy Backend to Railway

#### 1.1. Prepare Backend

Add `Procfile` in `backend/`:

```
web: node server.js
```

Add start script to `backend/package.json`:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

#### 1.2. Deploy to Railway

1. **Create account**: https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. **Select** `manga-verse` repository
4. **Root Directory**: Set to `backend`
5. **Add variables**:
   ```
   MONGODB_URI=your_mongodb_connection_string
   IMAGEKIT_PUBLIC_KEY=your_key
   IMAGEKIT_PRIVATE_KEY=your_key
   IMAGEKIT_URL_ENDPOINT=your_endpoint
   FLARESOLVERR_URL=your_flaresolverr_url
   PORT=5000
   ```
6. **Deploy**!
7. **Copy URL**: e.g., `https://manga-verse-api.railway.app`

#### Alternative: Render.com

1. **Create account**: https://render.com
2. **New Web Service** → Connect GitHub
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Add environment variables** (same as Railway)
6. **Deploy**!

---

### Part 2: Deploy Frontend to Vercel

#### 2.1. Update API URL

In `frontend/vercel.json`, replace backend URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-RAILWAY-URL.railway.app/api/:path*"
    }
  ]
}
```

Or use environment variable in `frontend/.env.production`:

```
NEXT_PUBLIC_API_URL=https://YOUR-RAILWAY-URL.railway.app
```

#### 2.2. Deploy to Vercel

**Option A: Vercel CLI**

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Production deploy
vercel --prod
```

**Option B: Vercel Dashboard**

1. **Create account**: https://vercel.com
2. **Import Project** → Select GitHub repo
3. **Framework Preset**: Next.js
4. **Root Directory**: `frontend`
5. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   ```
6. **Deploy**!

---

### Part 3: Setup MongoDB Atlas

1. **Create account**: https://mongodb.com/cloud/atlas
2. **Create Cluster** (Free tier M0)
3. **Database Access**:
   - Create user
   - Password: Save it!
4. **Network Access**:
   - Add IP: `0.0.0.0/0` (allow all)
5. **Connect**:
   - Copy connection string
   - Replace `<password>` with your password
6. **Add to Railway**:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/manga-verse
   ```

---

## 🔧 Configuration Files

### `.gitignore` (Root)

```gitignore
# Already created at /manga-verse/.gitignore
```

### `frontend/vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "@api-url"
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend.railway.app/api/:path*"
    }
  ]
}
```

### `backend/Procfile` (Railway/Heroku)

```
web: node server.js
```

### `backend/package.json` (update scripts)

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## 🌍 Environment Variables

### Backend (Railway)

```env
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/manga-verse

# ImageKit
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# FlareSolverr
FLARESOLVERR_URL=https://vuthanhdat2k3-flaresolverr.hf.space/v1

# Server
PORT=5000
NODE_ENV=production
```

### Frontend (Vercel)

```env
NEXT_PUBLIC_API_URL=https://manga-verse-api.railway.app
```

---

## ✅ Deployment Checklist

### Before Deploy

- [ ] Test locally
  - [ ] `cd frontend && npm run build`
  - [ ] `cd backend && npm start`
- [ ] Update `.gitignore`
- [ ] Remove sensitive data from code
- [ ] Setup MongoDB Atlas
- [ ] Get ImageKit credentials
- [ ] Get FlareSolverr URL

### Backend (Railway)

- [ ] Create Railway project
- [ ] Set root directory to `backend`
- [ ] Add environment variables
- [ ] Deploy
- [ ] Test health check: `https://YOUR-URL/api/health`
- [ ] Copy backend URL

### Frontend (Vercel)

- [ ] Update `vercel.json` with backend URL
- [ ] Create Vercel project
- [ ] Set root directory to `frontend`
- [ ] Add `NEXT_PUBLIC_API_URL` variable
- [ ] Deploy
- [ ] Test frontend: `https://YOUR-URL.vercel.app`

### DNS (Optional)

- [ ] Buy domain
- [ ] Point to Vercel (frontend)
- [ ] Setup CNAME for backend

---

## 🧪 Testing Deployment

### 1. Test Backend

```bash
# Health check
curl https://your-backend.railway.app/api/health

# Get mangas
curl https://your-backend.railway.app/api/mangas

# Search
curl "https://your-backend.railway.app/api/search?keyword=one+piece"
```

### 2. Test Frontend

1. Open `https://your-app.vercel.app`
2. See manga list
3. Search for manga
4. Click to view details
5. Read a chapter

---

## 🔄 Update Deployment

### Frontend

```bash
cd frontend
git add .
git commit -m "Update frontend"
git push

# Vercel auto-deploys on push
```

### Backend

```bash
cd backend
git add .
git commit -m "Update backend"
git push

# Railway auto-deploys on push
```

---

## 🐛 Troubleshooting

### Issue: Frontend can't connect to Backend

**Solution:**
1. Check `NEXT_PUBLIC_API_URL` in Vercel
2. Check CORS in backend:
   ```javascript
   app.use(cors({
     origin: ['https://your-frontend.vercel.app']
   }));
   ```

### Issue: MongoDB connection failed

**Solution:**
1. Check MongoDB Atlas network access (0.0.0.0/0)
2. Verify connection string
3. Check username/password

### Issue: Crawler timeout on Vercel

**Solution:**
- Don't run crawler on Vercel (use Railway for backend)
- Vercel has 10s timeout for serverless functions

### Issue: Environment variables not working

**Solution:**
1. Rebuild deployment
2. Check variable names (exact match)
3. For Next.js, must start with `NEXT_PUBLIC_`

---

## 📊 Expected Costs

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Hobby | **Free** |
| Railway | Starter | **$5/month** (500h) |
| MongoDB Atlas | M0 | **Free** |
| ImageKit | Free | **Free** (20GB/mo) |
| **Total** | | **~$5/month** |

### Railway Free Tier Alternative

- 500 hours/month free
- After that: $0.000231/GB-hour

---

## 🎯 Production Optimizations

### 1. Enable Caching

```javascript
// backend/server.js
app.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300');
  next();
});
```

### 2. Compress Responses

```bash
npm install compression
```

```javascript
const compression = require('compression');
app.use(compression());
```

### 3. Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use('/api/', limiter);
```

### 4. Health Monitoring

Use **UptimeRobot** (free) to monitor:
- Frontend: https://your-app.vercel.app
- Backend: https://your-api.railway.app/api/health

---

## 🚀 Ready to Deploy!

Follow the steps above and your MangaVerse will be live! 🎉

**Questions?** Check the docs or create an issue on GitHub.
