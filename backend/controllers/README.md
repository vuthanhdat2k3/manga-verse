# Controllers

Controllers handle the business logic for API endpoints.

## Structure

```
controllers/
├── mangaController.js     # Manga CRUD operations
├── chapterController.js   # Chapter operations
└── searchController.js    # Search & crawl operations
```

## Pattern

Each controller exports handler functions:

```javascript
exports.handlerName = async (req, res) => {
  try {
    // 1. Extract & validate parameters
    const { param } = req.params;
    
    // 2. Execute business logic
    const result = await Model.operation();
    
    // 3. Return response
    res.json(result);
  } catch (error) {
    // 4. Handle errors
    console.error('Error context:', error);
    res.status(500).json({ error: error.message });
  }
};
```

## Controllers Reference

### `mangaController.js`

#### `getAllMangas(req, res)`
- **Purpose:** Get all mangas with pagination and search
- **Query Params:** 
  - `page` (number, default: 1)
  - `limit` (number, default: 20)
  - `search` (string, optional)
- **Returns:** `{ data: Manga[], pagination: {...} }`

#### `getMangaById(req, res)`
- **Purpose:** Get manga detail by ID
- **Params:** `id` (manga slug)
- **Returns:** `Manga` object or 404

---

### `chapterController.js`

#### `getChapterImages(req, res)`
- **Purpose:** Get chapter images with lazy crawling
- **Params:** 
  - `mangaId` (manga slug)
  - `chapterId` (chapter slug)
- **Features:**
  - Auto-triggers crawl if chapter not found
  - Calculates prev/next navigation
- **Returns:** `{ images: [...], navigation: {...} }`

---

### `searchController.js`

#### `searchManga(req, res)`
- **Purpose:** Search manga on NetTruyen
- **Query Params:** `keyword` (required)
- **Returns:** `{ success: true, results: [...], count: N }`

#### `crawlFromUrl(req, res)`
- **Purpose:** Crawl manga from URL
- **Body:** `{ url: "..." }` (URL or manga ID)
- **Returns:** `{ success: true, manga: {...} }`

## Adding New Controllers

1. **Create file:** `controllers/newController.js`

```javascript
const Model = require('../models/Model');

exports.handlerName = async (req, res) => {
  try {
    // Your logic here
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;
```

2. **Create route:** `routes/newRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const controller = require('../controllers/newController');

router.get('/', controller.handlerName);

module.exports = router;
```

3. **Mount in server.js:**

```javascript
const newRoutes = require('./routes/newRoutes');
app.use('/api/new', newRoutes);
```

## Best Practices

✅ **Always use try-catch**
✅ **Validate input parameters**
✅ **Log errors with context**
✅ **Return consistent response format**
✅ **Use appropriate HTTP status codes**

## Testing

```javascript
const controller = require('./controllers/mangaController');

const mockReq = { query: { page: 1 } };
const mockRes = {
  json: jest.fn(),
  status: jest.fn().mockReturnThis()
};

await controller.getAllMangas(mockReq, mockRes);
expect(mockRes.json).toHaveBeenCalled();
```
