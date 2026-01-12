const { spawn } = require('child_process');
const path = require('path');
const Manga = require('../models/Manga');
const ChapterDetail = require('../models/ChapterDetail');

/**
 * Get chapter images with lazy crawling
 */
exports.getChapterImages = async (req, res) => {
  try {
    const { mangaId, chapterId } = req.params;
    
    // Query with correct field names (snake_case to match schema)
    let detail = await ChapterDetail.findOne({ 
      manga_id: mangaId, 
      chapter_id: chapterId 
    });
    
    // Lazy Crawl if missing
    if (!detail) {
      console.log(`⚠️ Chapter ${chapterId} missing. Triggering lazy crawl...`);
      
      try {
        await new Promise((resolve, reject) => {
          const scriptPath = path.resolve(__dirname, '../../crawler/crawl-chapter.js');
          const crawler = spawn('node', [scriptPath, mangaId, chapterId], { stdio: 'inherit' });
          
          crawler.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Crawler failed with code ${code}`));
          });
        });

        // Re-fetch after crawl
        detail = await ChapterDetail.findOne({ 
          manga_id: mangaId, 
          chapter_id: chapterId 
        });
        
        if (detail) {
          console.log(`✅ Successfully crawled chapter ${chapterId}`);
        }
      } catch (crawlError) {
        console.error('❌ Lazy crawl failed:', crawlError.message);
      }
    }

    if (!detail) {
      return res.status(404).json({ 
        error: 'Chapter content not available',
        message: 'Failed to crawl chapter. Please try again later.'
      });
    }
    
    // Also fetch prev/next chapter info from Manga
    const manga = await Manga.findOne({ id: mangaId });
    let prev = null, next = null;
    
    if (manga && manga.chapters) {
      const idx = manga.chapters.findIndex(c => c.id === chapterId);
      
      if (idx !== -1) {
        // Navigation logic
        // Assuming chapters array is [Ch newest, ..., Ch oldest]
        // In [Ch 100, Ch 99, ... Ch 1]:
        // - Ch 100 is at index 0, Ch 99 at index 1
        // - "Next" (higher chapter number) is idx - 1
        // - "Prev" (lower chapter number) is idx + 1
        
        if (idx > 0) next = manga.chapters[idx - 1];
        if (idx < manga.chapters.length - 1) prev = manga.chapters[idx + 1];
      }
    }

    res.json({
      ...detail.toObject(),
      navigation: { prev, next }
    });
  } catch (error) {
    console.error("Get chapter error:", error);
    res.status(500).json({ error: error.message });
  }
};
