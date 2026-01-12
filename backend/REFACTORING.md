# 🏗️ Backend Refactoring - MVC Pattern

## Tổng quan

Đã refactor backend từ monolithic `server.js` sang pattern **MVC (Model-View-Controller)** với separation of concerns.

## ✅ Những gì đã thay đổi

### Before (Monolithic)
```
backend/
├── models/
│   ├── Manga.js
│   └── ChapterDetail.js
├── routes/ (empty)
└── server.js (189 lines - ALL logic here)
    ├── Database connection
    ├── Middleware
    ├── Route handlers (inline)
    │   ├── GET /api/mangas
    │   ├── GET /api/mangas/:id
    │   ├── GET /api/mangas/:mangaId/:chapterId
    │   ├── GET /api/search
    │   └── POST /api/crawl
    └── Server startup
```

### After (MVC Pattern)
```
backend/
├── controllers/          # NEW - Business logic
│   ├── mangaController.js
│   ├── chapterController.js
│   └── searchController.js
├── models/              # Models (unchanged)
│   ├── Manga.js
│   └── ChapterDetail.js
├── routes/              # NEW - Route definitions
│   ├── mangaRoutes.js
│   ├── chapterRoutes.js
│   └── searchRoutes.js
└── server.js (52 lines)  # Slim entry point
    ├── Database connection
    ├── Middleware
    ├── Route imports
    ├── Route mounting
    ├── Error handlers
    └── Server startup
```

## 📁 New Files

### 1. Controllers (Business Logic)

#### `controllers/mangaController.js`
```javascript
exports.getAllMangas = async (req, res) => { ... }
exports.getMangaById = async (req, res) => { ... }
```

**Responsibilities:**
- Fetch mangas with pagination
- Handle search queries
- Return manga details

#### `controllers/chapterController.js`
```javascript
exports.getChapterImages = async (req, res) => { ... }
```

**Responsibilities:**
- Get chapter images
- Trigger lazy crawling if needed
- Calculate prev/next navigation

#### `controllers/searchController.js`
```javascript
exports.searchManga = async (req, res) => { ... }
exports.crawlFromUrl = async (req, res) => { ... }
```

**Responsibilities:**
- Search manga on NetTruyen
- Crawl manga from URL
- Validate input parameters

### 2. Routes (Route Definitions)

#### `routes/mangaRoutes.js`
```javascript
router.get('/', mangaController.getAllMangas);
router.get('/:id', mangaController.getMangaById);
```

#### `routes/chapterRoutes.js`
```javascript
router.get('/:mangaId/:chapterId', chapterController.getChapterImages);
```

#### `routes/searchRoutes.js`
```javascript
router.get('/', searchController.searchManga);
router.post('/', searchController.crawlFromUrl);
```

### 3. Updated `server.js`

**From 189 lines → 52 lines** (73% reduction)

```javascript
// Clean, focused entry point
const mangaRoutes = require('./routes/mangaRoutes');
const chapterRoutes = require('./routes/chapterRoutes');
const searchRoutes = require('./routes/searchRoutes');

app.use('/api/mangas', mangaRoutes);
app.use('/api/mangas', chapterRoutes); // Nested for backward compatibility
app.use('/api/search', searchRoutes);
app.use('/api/crawl', searchRoutes);
```

## 🔄 URL Mapping

| Endpoint | Method | Route File | Controller Method |
|----------|--------|------------|-------------------|
| `/api/mangas` | GET | mangaRoutes | getAllMangas |
| `/api/mangas/:id` | GET | mangaRoutes | getMangaById |
| `/api/mangas/:mangaId/:chapterId` | GET | chapterRoutes | getChapterImages |
| `/api/search?keyword=...` | GET | searchRoutes | searchManga |
| `/api/crawl` | POST | searchRoutes | crawlFromUrl |

## 📊 Benefits

### 1. **Separation of Concerns**
```
Routes → Define endpoints
Controllers → Handle business logic
Models → Define data structure
```

### 2. **Better Maintainability**
- Each controller focuses on one domain
- Easier to find and fix bugs
- Clear file organization

### 3. **Easier Testing**
```javascript
// Can test controller independently
const { getAllMangas } = require('./controllers/mangaController');

// Mock req, res
const req = { query: { page: 1 } };
const res = { json: jest.fn() };

await getAllMangas(req, res);
expect(res.json).toHaveBeenCalled();
```

### 4. **Scalability**
- Add new endpoints easily
- Separate concerns by feature
- Middleware can be added per route

### 5. **Code Reusability**
- Controllers can be reused
- Validators can be added as middleware
- Shared logic in utilities

## 🆕 New Features

### Health Check Endpoint
```http
GET /api/health

Response:
{
  "status": "ok",
  "timestamp": "2026-01-12T16:06:26.000Z",
  "database": "connected"
}
```

### 404 Handler
```javascript
// Any undefined route
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});
```

### Global Error Handler
```javascript
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

## 🔧 Technical Details

### Controller Pattern
```javascript
// Export functions that accept (req, res)
exports.handlerName = async (req, res) => {
  try {
    // 1. Extract parameters
    const { param } = req.params;
    
    // 2. Business logic
    const result = await Model.find({ ... });
    
    // 3. Return response
    res.json(result);
  } catch (error) {
    // 4. Error handling
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};
```

### Route Pattern
```javascript
const express = require('express');
const router = express.Router();
const controller = require('../controllers/someController');

// Define routes
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);

module.exports = router;
```

### Server Mounting
```javascript
// Import route modules
const someRoutes = require('./routes/someRoutes');

// Mount at base path
app.use('/api/resource', someRoutes);

// Now accessible at:
// GET /api/resource/
// GET /api/resource/:id
```

## 🔄 Migration Notes

### Backward Compatibility
✅ **All existing endpoints work exactly the same**

Frontend doesn't need any changes:
```javascript
// Still works
await api.get('/mangas');
await api.get('/mangas/one-piece');
await api.get('/mangas/one-piece/chuong-1');
await api.get('/search?keyword=naruto');
await api.post('/crawl', { url: '...' });
```

### Why Chapter Route is under `/api/mangas`?
```javascript
// Original URL
GET /api/mangas/:mangaId/:chapterId

// Could have been
GET /api/chapters/:mangaId/:chapterId

// But we kept it under /api/mangas for backward compatibility
app.use('/api/mangas', chapterRoutes);
```

## 📏 Code Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| `server.js` lines | 189 | 52 | -73% |
| Total files | 1 | 7 | +6 |
| Controllers | 0 | 3 | +3 |
| Routes | 0 | 3 | +3 |
| LOC (total) | 189 | ~250 | +32% |

**Note:** Total LOC increased but:
- Much better organized
- Easier to maintain
- Follows best practices
- Each file has single responsibility

## 🎯 Best Practices Implemented

### 1. **Error Handling**
```javascript
// Every controller has try-catch
try {
  // Logic
} catch (error) {
  console.error('Context:', error);
  res.status(500).json({ error: error.message });
}
```

### 2. **Validation**
```javascript
if (!keyword) {
  return res.status(400).json({ error: 'Keyword is required' });
}
```

### 3. **Logging**
```javascript
console.log(`🔍 Search request: "${keyword}"`);
console.error('Get mangas error:', error);
```

### 4. **Status Codes**
```javascript
res.json(data);              // 200 OK
res.status(404).json(...);   // 404 Not Found
res.status(400).json(...);   // 400 Bad Request
res.status(500).json(...);   // 500 Internal Server Error
```

### 5. **Consistent Response Format**
```javascript
// Success
{ data: [...], pagination: {...} }
{ success: true, manga: {...} }

// Error
{ error: 'Error message' }
{ success: false, error: 'Error message' }
```

## 🚀 Future Improvements

### 1. Add Middleware
```javascript
// routes/mangaRoutes.js
const { validatePagination } = require('../middleware/validators');

router.get('/', validatePagination, mangaController.getAllMangas);
```

### 2. Add Services Layer
```
Controllers → Services → Models
```

```javascript
// services/mangaService.js
exports.getAllMangas = async (query) => {
  return await Manga.find(query).sort(...).limit(...);
};

// Controller just calls service
const mangaService = require('../services/mangaService');
exports.getAllMangas = async (req, res) => {
  const mangas = await mangaService.getAllMangas(req.query);
  res.json(mangas);
};
```

### 3. Add DTO (Data Transfer Objects)
```javascript
// dto/MangaDTO.js
class MangaDTO {
  constructor(manga) {
    this.id = manga.id;
    this.title = manga.title;
    this.thumbnail = manga.thumbnail;
    // Transform data
  }
}
```

### 4. Add API Documentation
```javascript
/**
 * @route GET /api/mangas
 * @desc Get all mangas with pagination
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @query {string} search - Search keyword (optional)
 * @returns {Object} { data: Manga[], pagination: {...} }
 */
```

### 5. Add Unit Tests
```javascript
// tests/controllers/mangaController.test.js
describe('MangaController', () => {
  describe('getAllMangas', () => {
    it('should return paginated mangas', async () => {
      // Test logic
    });
  });
});
```

## 📘 Usage Examples

### Testing Individual Controllers

```javascript
// test.js
const { getAllMangas } = require('./controllers/mangaController');

// Mock request/response
const mockReq = {
  query: { page: 1, limit: 10 }
};

const mockRes = {
  json: (data) => console.log('Response:', data),
  status: (code) => ({
    json: (data) => console.log(`${code}:`, data)
  })
};

await getAllMangas(mockReq, mockRes);
```

### Adding New Endpoints

```javascript
// 1. Create controller
// controllers/userController.js
exports.getUsers = async (req, res) => { ... };

// 2. Create route
// routes/userRoutes.js
router.get('/', userController.getUsers);

// 3. Mount in server.js
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);
```

## ✅ Verification

Test all endpoints still work:

```bash
# Health check (new)
curl http://localhost:5000/api/health

# Get mangas
curl http://localhost:5000/api/mangas

# Get manga detail
curl http://localhost:5000/api/mangas/one-piece

# Get chapter
curl http://localhost:5000/api/mangas/one-piece/chuong-1

# Search
curl "http://localhost:5000/api/search?keyword=naruto"

# Crawl
curl -X POST http://localhost:5000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://nettruyen.me.uk/truyen-tranh/naruto"}'
```

---

**Refactoring Date:** 2026-01-12  
**Pattern:** MVC (Model-View-Controller)  
**Status:** ✅ Complete  
**Breaking Changes:** None (100% backward compatible)
