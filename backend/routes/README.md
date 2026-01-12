# Routes

Routes define API endpoints and map them to controller handlers.

## Structure

```
routes/
├── mangaRoutes.js      # Manga endpoints
├── chapterRoutes.js    # Chapter endpoints
└── searchRoutes.js     # Search & crawl endpoints
```

## Pattern

```javascript
const express = require('express');
const router = express.Router();
const controller = require('../controllers/controller');

router.METHOD('/path', controller.handler);

module.exports = router;
```

## Routes Reference

### `mangaRoutes.js`

Mounted at: `/api/mangas`

| Method | Path | Handler | Full URL |
|--------|------|---------|----------|
| GET | `/` | getAllMangas | `/api/mangas` |
| GET | `/:id` | getMangaById | `/api/mangas/:id` |

---

### `chapterRoutes.js`

Mounted at: `/api/mangas` (for backward compatibility)

| Method | Path | Handler | Full URL |
|--------|------|---------|----------|
| GET | `/:mangaId/:chapterId` | getChapterImages | `/api/mangas/:mangaId/:chapterId` |

---

### `searchRoutes.js`

Mounted at: `/api/search` and `/api/crawl`

| Method | Path | Handler | Full URL |
|--------|------|---------|----------|
| GET | `/` | searchManga | `/api/search` |
| POST | `/` | crawlFromUrl | `/api/crawl` |

## Mounting

In `server.js`:

```javascript
const mangaRoutes = require('./routes/mangaRoutes');
const chapterRoutes = require('./routes/chapterRoutes');
const searchRoutes = require('./routes/searchRoutes');

app.use('/api/mangas', mangaRoutes);
app.use('/api/mangas', chapterRoutes);  // Nested
app.use('/api/search', searchRoutes);
app.use('/api/crawl', searchRoutes);
```

## Adding Middleware

### Route-specific Middleware

```javascript
const { validateInput } = require('../middleware/validators');

router.post('/', validateInput, controller.create);
```

### Router-level Middleware

```javascript
router.use(authMiddleware); // Applies to all routes in this file

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
```

## Adding New Routes

1. **Create route file:** `routes/newRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const controller = require('../controllers/newController');

// Define routes
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
```

2. **Mount in server.js:**

```javascript
const newRoutes = require('./routes/newRoutes');
app.use('/api/resource', newRoutes);
```

## REST Conventions

| Method | Path | Action | Description |
|--------|------|--------|-------------|
| GET | `/resource` | index | List all |
| GET | `/resource/:id` | show | Get one |
| POST | `/resource` | create | Create new |
| PUT | `/resource/:id` | update | Update existing |
| PATCH | `/resource/:id` | update | Partial update |
| DELETE | `/resource/:id` | destroy | Delete |

## Nested Routes

```javascript
// Parent route
app.use('/api/mangas', mangaRoutes);

// Nested route
app.use('/api/mangas', chapterRoutes);

// Results in:
// /api/mangas              → mangaRoutes
// /api/mangas/:mangaId/:chapterId → chapterRoutes
```

## Testing

```bash
# Test route directly
curl http://localhost:5000/api/mangas

# With parameters
curl http://localhost:5000/api/mangas/one-piece

# With query string
curl "http://localhost:5000/api/search?keyword=naruto"

# POST request
curl -X POST http://localhost:5000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```
