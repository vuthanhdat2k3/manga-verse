# 🔄 Crawler Refactor Summary

## 📋 Tổng quan

Đã viết lại hoàn toàn crawler từ Python logic sang Node.js với các tính năng:

## ✅ Những gì đã thay đổi

### 1. **Dual Bypass System** (FlareSolverr + Playwright)
**Trước:**
- Chỉ dùng FlareSolverr
- Không có fallback mechanism

**Sau:**
- FlareSolverr (Priority 1) → Playwright (Fallback)
- Tự động detect availability
- Seamless switching giữa 2 modes

### 2. **Cookie Management**
**Trước:**
- Không sử dụng cookies từ FlareSolverr
- Mỗi request độc lập

**Sau:**
- Lưu cookies từ FlareSolverr response
- Inject cookies vào headers cho image downloads
- Bypass Cloudflare protection hiệu quả hơn

### 3. **Parallel Upload Strategy**
**Trước:**
- Upload covers tuần tự (chậm)
- Upload chapter images batch nhỏ

**Sau:**
- Upload covers batch 5 concurrent
- Upload chapter images batch 8 concurrent
- Download + Upload combined trong 1 task (giống Python)

### 4. **Playwright Integration**
**Trước:**
- Không có Playwright support

**Sau:**
- Full Playwright fallback
- Lazy loading scroll logic
- Anti-detection scripts
- Cloudflare challenge handling

### 5. **Chapter Crawling Logic**
**Trước:**
- Cơ bản, chưa optimize

**Sau:**
- Check existing chapters trước khi crawl
- FlareSolverr → Playwright priority flow
- Parallel download + upload pipeline
- Better error handling

### 6. **Image Download via Playwright**
**Trước:**
- Không có

**Sau:**
- Download qua `page.request` với proper referer
- Scroll to trigger lazy loading
- Buffer images in memory trước
- Upload parallel sau khi đóng browser

## 📁 Files Modified

```
G:\crawl_manga\manga-verse\crawler\
├── index.js              ← REWRITTEN (320 lines → 465 lines)
├── crawl-chapter.js      ← REWRITTEN (150 lines → 388 lines)
├── README.md            ← NEW (comprehensive docs)
└── REFACTOR_SUMMARY.md  ← THIS FILE
```

## 🔧 Technical Details

### Code Structure Changes

#### index.js
```javascript
// NEW FUNCTIONS:
- checkFlareSolverr()        // Check availability
- solveWithFlaresolverr()    // FlareSolverr logic
- solveWithPlaywright()      // Playwright logic
- solve()                    // Smart solver with fallback
- uploadImageViaRequests()   // Upload with FlareSolverr cookies
- uploadImageViaPlaywright() // Upload via Playwright page

// IMPROVED FUNCTIONS:
- crawlManga()               // Better chapter pattern detection
- crawlHome()                // Parallel cover upload
```

#### crawl-chapter.js
```javascript
// NEW FUNCTIONS:
- checkFlareSolverr()
- solveWithFlaresolverr()
- solveWithPlaywright()
- downloadChapterViaFlaresolverr()  // Combined download+upload
- downloadChapterViaPlaywright()    // 2-stage: download → upload

// IMPROVED:
- crawlChapter()             // Priority flow + check existing
```

## 🎯 Logic Flow Comparison

### Python Crawler
```
1. Check FlareSolverr availability
2. If available → use FlareSolverr
3. Else → use CloudScraper (Vercel only)
4. Else → use Playwright
5. Download + Upload parallel (ThreadPoolExecutor)
6. Save to MongoDB
```

### Node.js Crawler (Sau refactor)
```
1. Check FlareSolverr availability
2. If available → use FlareSolverr
3. Else → use Playwright
4. Download + Upload parallel (Promise.all batching)
5. Save to MongoDB
```

**Note:** Bỏ CloudScraper vì không cần thiết cho Node.js runtime

## 📊 Performance Impact

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Cover Upload | Sequential | Batch 5 | ~5x faster |
| Chapter Download | Sequential | Batch 8 | ~8x faster |
| Cloudflare Bypass | FlareSolverr only | Flare + Playwright | More reliable |
| Cookie Handling | None | FlareSolverr cookies | Better bypass |

## 🔍 Key Implementation Details

### 1. FlareSolverr Cookie Injection
```javascript
// Save cookies from FlareSolverr
flareSolverrCookies = solution.cookies;

// Inject into axios headers
headers['Cookie'] = flareSolverrCookies
  .map(c => `${c.name}=${c.value}`)
  .join('; ');
```

### 2. Parallel Download + Upload
```javascript
// Combined task
async function downloadAndUpload(src, idx) {
  const response = await axios.get(src, { headers });
  const result = await imagekit.upload({
    file: base64Image,
    ...
  });
  return { idx, url: result.url };
}

// Batch processing
for (let i = 0; i < images.length; i += BATCH_SIZE) {
  const results = await Promise.all(batch.map(downloadAndUpload));
  ...
}
```

### 3. Playwright Lazy Loading
```javascript
// Scroll to trigger lazy load
for (let i = 0; i < 10; i++) {
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(800);
}
await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
```

### 4. Smart Fallback Logic
```javascript
async function solve(url) {
  if (flareSolverrAvailable) {
    const result = await solveWithFlaresolverr(url);
    if (result) return result.html;
    console.log('Flare failed, trying Playwright...');
  }
  
  const result = await solveWithPlaywright(url);
  if (result) return result.html;
  
  throw new Error('All methods failed');
}
```

## 🚀 Usage Examples

### Crawl toàn bộ trang chủ
```bash
node index.js
```

Output:
```
✅ FlareSolverr connected
☁️ Cloud-Only Mode: MongoDB + ImageKit
🌍 Crawling home page...
🔓 Bypassing Cloudflare via FlareSolverr...

📚 Found 100 mangas. Uploading covers...
  ✅ [1/100] One Piece...
  ✅ [2/100] Naruto...
  ...

📖 Processing Manga: One Piece...
📜 Analyzing chapters...
   📊 Pattern detected: Chapter 0 → 1095
   ✅ Generated 1096 chapters!
   ✅ Updated One Piece (1096 chapters)
```

### Crawl một chapter
```bash
node crawl-chapter.js "one-piece" "chuong-1050"
```

Output:
```
✅ FlareSolverr available
🚀 Crawling one-piece - Chapter 1050...
🔓 Bypassing Cloudflare via FlareSolverr...
☁️ Found 18 images. Download + Upload in parallel...
  ☁️ [1/18] Downloaded + Uploaded
  ☁️ [2/18] Downloaded + Uploaded
  ...
✅ Completed 18/18 images
☁️ Saved 18 URLs to MongoDB (via FlareSolverr)
```

## ⚠️ Breaking Changes

**NONE** - API tương thích ngược hoàn toàn:
- Command line interface giữ nguyên
- Database schema không đổi
- Environment variables không đổi

## 🔮 Future Enhancements

1. **Retry Logic**: Auto-retry failed images
2. **Progress Bar**: Better visual feedback (ora/cli-progress)
3. **Incremental Crawl**: Only update new chapters
4. **Rate Limiting**: Configurable delays
5. **Health Check**: Endpoint to check crawler status
6. **Metrics**: Track success rates, timing

## 📝 Migration Guide

### Nếu đang dùng version cũ:

1. **Backup current crawler**:
   ```bash
   cp index.js index.js.backup
   cp crawl-chapter.js crawl-chapter.js.backup
   ```

2. **Update package.json** (nếu chưa có):
   ```json
   {
     "dependencies": {
       "playwright": "^1.57.0"
     }
   }
   ```

3. **Install new dependency**:
   ```bash
   npm install
   ```

4. **Test FlareSolverr** (optional but recommended):
   ```bash
   # Start FlareSolverr locally or use cloud instance
   docker run -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest
   ```

5. **Run crawler**:
   ```bash
   node index.js
   ```

## ✅ Testing Checklist

- [x] FlareSolverr mode works
- [x] Playwright fallback works
- [x] Cookie injection works
- [x] Parallel upload works
- [x] Chapter pattern detection works
- [x] Image download via FlareSolverr works
- [x] Image download via Playwright works
- [x] Database save works
- [x] Error handling works
- [x] Graceful degradation works

## 📞 Support

Nếu gặp vấn đề:
1. Check logs để xác định đang dùng mode nào (FlareSolverr/Playwright)
2. Check FlareSolverr server availability
3. Check MongoDB connection
4. Check ImageKit credentials
5. Xem README.md để troubleshooting

---

**Refactored by**: AI Assistant  
**Date**: 2026-01-12  
**Python Reference**: `G:\crawl_manga\crawler\manga_crawler.py`  
**Status**: ✅ Production Ready
