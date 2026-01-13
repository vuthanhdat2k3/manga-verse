require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Manga = require('./models/Manga');
const ChapterDetail = require('./models/ChapterDetail');
const Config = require('./models/Config');

// Import search crawler for search and crawl routes
const searchCrawler = require('../crawler/search-crawler');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const adminRoutes = require('./routes/adminRoutes');

// ... (previous imports)

// Health check endpoint for Render
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'MangaVerse API is running' });
});

app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {

  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===========================================
// SEARCH & CRAWL ROUTES
// ===========================================

// Search manga on NetTruyen
app.get('/api/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }
    
    console.log(`🔍 Search request: "${keyword}"`);
    const results = await searchCrawler.searchManga(keyword);
    
    res.json({
      success: true,
      keyword: keyword,
      count: results.length,
      results: results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Crawl manga from URL
app.post('/api/crawl', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL or manga ID is required' });
    }
    
    console.log(`📖 Crawl request: "${url}"`);
    const manga = await searchCrawler.crawlFromUrl(url);
    
    res.json({
      success: true,
      manga: manga
    });
  } catch (error) {
    console.error('Crawl error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Crawl multiple chapters in a range
app.post('/api/crawl-chapter-range', async (req, res) => {
  const { spawn } = require('child_process');
  const path = require('path');
  
  try {
    const { mangaId, startChapterId, endChapterId } = req.body;
    
    if (!mangaId || !startChapterId || !endChapterId) {
      return res.status(400).json({ 
        success: false,
        error: 'mangaId, startChapterId, and endChapterId are required' 
      });
    }
    
    console.log(`📚 Batch crawl request: ${mangaId} from ${startChapterId} to ${endChapterId}`);
    
    // Get manga info to find chapters
    const manga = await Manga.findOne({ id: mangaId });
    if (!manga) {
      return res.status(404).json({ success: false, error: 'Manga not found' });
    }
    
    // Find chapter indices
    const chapters = manga.chapters || [];
    const startIdx = chapters.findIndex(ch => ch.id === startChapterId);
    const endIdx = chapters.findIndex(ch => ch.id === endChapterId);
    
    if (startIdx === -1 || endIdx === -1) {
      return res.status(400).json({ success: false, error: 'Invalid chapter selection' });
    }
    
    // Get chapters to crawl (from startIdx to endIdx inclusive)
    // Note: chapters array is [newest, ..., oldest], so startIdx < endIdx means start is newer
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const chaptersToCrawl = chapters.slice(minIdx, maxIdx + 1);
    
    console.log(`📚 Will crawl ${chaptersToCrawl.length} chapters`);
    
    // Crawl chapters sequentially (to avoid overloading)
    let crawledCount = 0;
    const scriptPath = path.resolve(__dirname, '../crawler/crawl-chapter.js');
    
    for (const chapter of chaptersToCrawl) {
      // Check if already crawled
      const existing = await ChapterDetail.findOne({ 
        manga_id: mangaId, 
        chapter_id: chapter.id 
      });
      
      if (existing && existing.images && existing.images.length > 0) {
        console.log(`⏭️ Skipping ${chapter.id} (already crawled)`);
        crawledCount++; // Count as success since it exists
        continue;
      }
      
      // Crawl chapter
      console.log(`🚀 Crawling ${chapter.id}...`);
      
      try {
        await new Promise((resolve, reject) => {
          const crawler = spawn('node', [scriptPath, mangaId, chapter.id], { 
            stdio: 'inherit',
            timeout: 120000 // 2 minute timeout per chapter
          });
          
          crawler.on('close', (code) => {
            if (code === 0) {
              crawledCount++;
              resolve();
            } else {
              console.error(`❌ Crawler failed for ${chapter.id} with code ${code}`);
              resolve(); // Continue to next chapter even if one fails
            }
          });
          
          crawler.on('error', (err) => {
            console.error(`❌ Crawler error for ${chapter.id}:`, err.message);
            resolve(); // Continue to next chapter even if one fails
          });
        });
      } catch (crawlError) {
        console.error(`❌ Error crawling ${chapter.id}:`, crawlError.message);
        // Continue to next chapter
      }
    }
    
    res.json({
      success: true,
      message: `Crawled ${crawledCount}/${chaptersToCrawl.length} chapters`,
      crawledCount: crawledCount,
      totalRequested: chaptersToCrawl.length
    });
    
  } catch (error) {
    console.error('Batch crawl error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ===========================================
// CONFIG ROUTES
// ===========================================

app.get('/api/config', async (req, res) => {
  try {
    let config = await Config.findOne({ key: 'default' });
    if (!config) {
      config = await Config.create({ key: 'default' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const { baseUrl, mangaDetailUrlPattern, chapterUrlPattern } = req.body;
    const config = await Config.findOneAndUpdate(
      { key: 'default' },
      { 
        baseUrl, 
        mangaDetailUrlPattern, 
        chapterUrlPattern, 
        updatedAt: Date.now() 
      },
      { new: true, upsert: true }
    );
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// ROUTES
// ===========================================

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
    let manga = await Manga.findOne({ id: req.params.id });
    
    // Lazy Crawl: If not in DB, try to crawl it immediately
    if (!manga) {
       console.log(`⚠️ Manga ${req.params.id} not in DB. Attempting lazy crawl...`);
       try {
           // Use searchCrawler to fetch data directly
           // Note: This expects the ID to be a valid slug or URL part
           manga = await searchCrawler.crawlFromUrl(req.params.id);
       } catch(e) {
           console.error(`❌ Lazy crawl failed for ${req.params.id}:`, e.message);
       }
    }

    if (!manga) return res.status(404).json({ error: 'Manga not found' });

    // Check which chapters are actually downloaded (exist in ChapterDetail)
    const downloadedDocs = await ChapterDetail.find(
      { manga_id: manga.id }, 
      { chapter_id: 1, _id: 0 }
    );
    const downloadedSet = new Set(downloadedDocs.map(d => d.chapter_id));

    // Convert to object and inject status
    const result = manga.toObject();
    if (result.chapters) {
       result.chapters = result.chapters.map(c => ({
          ...c,
          downloaded: downloadedSet.has(c.id)
       }));
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 2.5 Manual Update Chapters
app.post('/api/mangas/:id/update-chapters', async (req, res) => {
  try {
    const mangaId = req.params.id;
    console.log(`🔄 Manual update triggered for manga: ${mangaId}`);
    
    // Check if manga exists
    let manga = await Manga.findOne({ id: mangaId });
    if (!manga) return res.status(404).json({ error: 'Manga not found' });

    // Trigger crawl
    const updatedManga = await searchCrawler.crawlFromUrl(manga.url || mangaId);
    
    res.json(updatedManga);
  } catch (error) {
    console.error('Update chapters error:', error);
    res.status(500).json({ error: error.message });
  }
});



// 3. Get Chapter Images (with Lazy Crawling)
const { spawn } = require('child_process');
const path = require('path');

app.get('/api/mangas/:mangaId/:chapterId', async (req, res) => {
  try {
    const { mangaId, chapterId } = req.params;
    let detail = await ChapterDetail.findOne({ manga_id: mangaId, chapter_id: chapterId });
    
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
        detail = await ChapterDetail.findOne({ manga_id: mangaId, chapter_id: chapterId });
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

// Database Connection & Server Start
(async () => {
  try {
    // Connect to MongoDB FIRST
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/manga-verse', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected');
    
    // THEN start server - MUST bind to 0.0.0.0 for Render
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
})();
