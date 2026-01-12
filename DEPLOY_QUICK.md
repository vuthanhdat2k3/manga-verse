# ⚡ Quick Deployment Guide

## 🎯 TL;DR

1. **Backend** → Railway (5 phút)
2. **Frontend** → Vercel (3 phút)  
3. **Database** → MongoDB Atlas (Free)

## 📋 Prerequisites

- [ ] GitHub account
- [ ] Railway account (https://railway.app)
- [ ] Vercel account (https://vercel.com)
- [ ] MongoDB Atlas account (https://mongodb.com/cloud/atlas)

## 🚀 Step-by-Step (15 minutes)

### Step 1: Setup MongoDB (3 min)

```
1. Go to https://mongodb.com/cloud/atlas
2. Create FREE cluster (M0)
3. Create database user
4. Network Access → Add IP: 0.0.0.0/0
5. Copy connection string
```

**Result:** `mongodb+srv://user:pass@cluster.mongodb.net/manga-verse`

---

### Step 2: Deploy Backend to Railway (5 min)

```
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select: manga-verse repo
4. Settings:
   - Root Directory: backend
   - Start Command: npm start
5. Variables:
   MONGODB_URI=<your_connection_string>
   IMAGEKIT_PUBLIC_KEY=<your_key>
   IMAGEKIT_PRIVATE_KEY=<your_key>
   IMAGEKIT_URL_ENDPOINT=<your_endpoint>
   FLARESOLVERR_URL=https://vuthanhdat2k3-flaresolverr.hf.space/v1
   PORT=5000
6. Deploy!
7. Copy URL: https://your-app.railway.app
```

**Test:** `https://your-app.railway.app/api/health`

---

### Step 3: Deploy Frontend to Vercel (3 min)

```
1. Update frontend/vercel.json:
   Change "destination" to your Railway URL

2. Go to https://vercel.com
3. Import Project → Select repo
4. Settings:
   - Framework: Next.js
   - Root Directory: frontend
5. Environment Variables:
   NEXT_PUBLIC_API_URL=https://your-app.railway.app
6. Deploy!
```

**Done!** Visit `https://your-app.vercel.app` 🎉

---

### Step 4: Update CORS (1 min)

In `backend/server.js`:

```javascript
app.use(cors({
  origin: ['https://your-app.vercel.app']
}));
```

Push to GitHub → Auto-redeploy!

---

## ✅ Verification

- [ ] Backend health: `curl https://YOUR-API.railway.app/api/health`
- [ ] Frontend loads: Open `https://YOUR-APP.vercel.app`
- [ ] Search works
- [ ] Can view manga detail
- [ ] Can read chapter

---

## 🆘 Common Issues

**Frontend shows "Failed to fetch"**
→ Check CORS in backend, verify API URL

**MongoDB connection error**
→ Check network access (0.0.0.0/0)

**Crawler timeout**
→ Normal on first request, will work on retry

---

## 💰 Cost

- Vercel: **FREE**
- Railway: **$5/month** (or 500h free)
- MongoDB: **FREE**

**Total: $5/month or FREE if using Railway free tier**

---

## 📚 Full Guide

See `DEPLOYMENT.md` for detailed instructions.

---

**Happy Deploying!** 🚀
