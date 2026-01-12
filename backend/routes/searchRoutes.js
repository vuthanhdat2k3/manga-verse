const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// GET /api/search?keyword=... - Search manga on NetTruyen
router.get('/', searchController.searchManga);

// POST /api/crawl - Crawl manga from URL
router.post('/', searchController.crawlFromUrl);

module.exports = router;
