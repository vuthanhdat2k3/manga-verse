const searchCrawler = require('../../crawler/search-crawler');

/**
 * Search manga on NetTruyen
 */
exports.searchManga = async (req, res) => {
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
};

/**
 * Crawl manga from URL
 */
exports.crawlFromUrl = async (req, res) => {
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
};
