# MangaVerse

Project Separate from `crawl_manga`. High-performance Manga Reader.

## Tech Stack
- **Frontend**: Next.js 15, Tailwind v4, Shadcn UI, TanStack Query, Zustand.
- **Backend**: Express.js, MongoDB (Mongoose).
- **Crawler**: Node.js, Playwright, ImageKit.

## Setup

### 1. Backend
```bash
cd backend
# Create .env from .env.example and fill details
npm install
npm start
```
Runs on `http://localhost:5000`.

### 2. Frontend
```bash
cd frontend
# Create .env.local with NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm install
npm run dev
```
Runs on `http://localhost:3000`.

### 3. Crawler
```bash
cd crawler
# Ensure backend is running (connects to same DB)
# Set up ImageKit credentials in backend/.env (crawler reads from there)
npm install
node index.js
```

## Features
- **Modern UI**: Violet/Indigo Premium Theme with Glassmorphism.
- **Reading**: Vertical scroll (Webtoon style) with simplified navigation.
- **History**: Local history using Zustand (Persist).
- **Optimization**: ImageKit upload for fast global loading.

## Deployment (Vercel)
- Push `frontend` to Vercel.
- Deploy `backend` to a VPS or Railway/Render, or adapt to Vercel Functions if preferred.
