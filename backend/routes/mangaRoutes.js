const express = require('express');
const router = express.Router();
const mangaController = require('../controllers/mangaController');

// GET /api/mangas - Get all mangas with pagination
router.get('/', mangaController.getAllMangas);

// GET /api/mangas/:id - Get manga detail
router.get('/:id', mangaController.getMangaById);

// POST /api/mangas/:id/update-chapters - Manual re-crawl
router.post('/:id/update-chapters', mangaController.updateChapters);

module.exports = router;
