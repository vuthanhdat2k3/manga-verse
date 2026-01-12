require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Manga = require('./models/Manga');
const ChapterDetail = require('./models/ChapterDetail');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/manga-verse')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes

// 1. Get All Mangas (with pagination and search)
app.get('/api/mangas', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};
    
    if (search) {
      query.$text = { $search: search };
    }

    const mangas = await Manga.find(query)
      .sort({ updated_at: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-chapters'); // Exclude chapters list for list view speed
      
    const total = await Manga.countDocuments(query);
    
    res.json({
      data: mangas,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get Manga Detail
app.get('/api/mangas/:id', async (req, res) => {
  try {
    const manga = await Manga.findOne({ id: req.params.id });
    if (!manga) return res.status(404).json({ error: 'Manga not found' });
    res.json(manga);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get Chapter Images (with Lazy Crawling)
const { spawn } = require('child_process');
const path = require('path');

app.get('/api/mangas/:mangaId/:chapterId', async (req, res) => {
  try {
    const { mangaId, chapterId } = req.params;
    let detail = await ChapterDetail.findOne({ mangaId, chapterId });
    
    // Lazy Crawl if missing
    if (!detail) {
        console.log(`⚠️ Chapter ${chapterId} missing. Triggering lazy crawl...`);
        
        await new Promise((resolve, reject) => {
            const scriptPath = path.resolve(__dirname, '../crawler/crawl-chapter.js');
            const crawler = spawn('node', [scriptPath, mangaId, chapterId], { stdio: 'inherit' });
            
            crawler.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Crawler failed with code ${code}`));
            });
        });

        // Re-fetch after crawl
        detail = await ChapterDetail.findOne({ mangaId, chapterId });
    }

    if (!detail) {
        return res.status(404).json({ error: 'Chapter content not available' });
    }
    
    // Also fetch prev/next chapter info from Manga
    const manga = await Manga.findOne({ id: mangaId });
    // Find current chapter index
    let prev = null, next = null;
    if (manga && manga.chapters) {
        const idx = manga.chapters.findIndex(c => c.id === chapterId);
        if (idx !== -1) {
            // Logic: usually chapters array is [Ch newest, ..., Ch oldest]
            // So "Next" chapter (reading forward) is actually at a LOWER index if sorted DESC
            // But let's verify sort. 
            // If [Ch10, Ch9, ... Ch1]
            // Current Ch9 (idx 1). 
            // Next chapter to read is Ch10? No, usually Ch10 is "newer". 
            // Reading "Next" usually means "Next logical part", so Ch10.
            // If data is [Ch Oldest ... Ch Newest], then Next is idx+1.
            
            // Assuming default crawler pushes in source order (often Newest First on sites)
            // If Newest First: [Ch 100, Ch 99, ... Ch 1]
            // Reading Ch 99. "Next" button should go to Ch 100? No, usually you read 1 -> 2 -> ... -> 99 -> 100.
            // So "Next" is higher number.
            // In [Ch 100... Ch 1], Ch 100 is at index 0. Ch 99 at index 1.
            // So "Next" (Ch 100) is idx - 1.
            
            if (idx > 0) next = manga.chapters[idx - 1]; 
            if (idx < manga.chapters.length - 1) prev = manga.chapters[idx + 1];
        }
    }

    res.json({
      ...detail.toObject(),
      navigation: { prev, next }
    });
  } catch (error) {
    console.error("Endpoint Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
