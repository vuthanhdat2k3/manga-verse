const express = require('express');
const router = express.Router();
const chapterController = require('../controllers/chapterController');

// GET /api/chapters/:mangaId/:chapterId - Get chapter images (with lazy crawl)
router.get('/:mangaId/:chapterId', chapterController.getChapterImages);

module.exports = router;
