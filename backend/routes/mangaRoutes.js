const express = require('express');
const router = express.Router();
const mangaController = require('../controllers/mangaController');

// GET /api/mangas - Get all mangas with pagination
router.get('/', mangaController.getAllMangas);

// GET /api/mangas/:id - Get manga detail
router.get('/:id', mangaController.getMangaById);

module.exports = router;
