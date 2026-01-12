const Manga = require('../models/Manga');

/**
 * Get all mangas with pagination and search
 */
exports.getAllMangas = async (req, res) => {
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
    console.error('Get mangas error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get manga detail by ID (with auto-crawl)
 */
exports.getMangaById = async (req, res) => {
  try {
    const mangaId = req.params.id;
    let manga = await Manga.findOne({ id: mangaId });
    
    // Auto-crawl if not found
    if (!manga) {
      console.log(`⚠️ Manga "${mangaId}" not found. Triggering auto-crawl...`);
      
      try {
        const searchCrawler = require('../../crawler/search-crawler');
        
        // Crawl from URL
        manga = await searchCrawler.crawlFromUrl(mangaId);
        
        console.log(`✅ Auto-crawled: ${manga.title}`);
      } catch (crawlError) {
        console.error('Auto-crawl failed:', crawlError.message);
        return res.status(404).json({ 
          error: 'Manga not found and auto-crawl failed',
          details: crawlError.message 
        });
      }
    }
    
    res.json(manga);
  } catch (error) {
    console.error('Get manga detail error:', error);
    res.status(500).json({ error: error.message });
  }
};
