# 🚀 Quick Start Guide

## ⚡ Chạy ngay lập tức

### 1. Cài đặt dependencies (nếu chưa)

```bash
cd G:\crawl_manga\manga-verse\crawler
npm install
```

### 2. Cài Playwright browsers (lần đầu tiên)

```bash
npx playwright install chromium
```

### 3. Chạy crawler

#### Option A: FlareSolverr Mode (Recommended)

**Bước 1:** Start FlareSolverr server
```bash
# Nếu có Docker:
docker run -d -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest

# Hoặc dùng cloud instance (đã có sẵn):
# https://vuthanhdat2k3-flaresolverr.hf.space/v1
```

**Bước 2:** Chạy crawler
```bash
node index.js
```

Expected output:
```
✅ FlareSolverr connected
☁️ Cloud-Only Mode: MongoDB + ImageKit
🌍 Crawling home page...
🔓 Bypassing Cloudflare via FlareSolverr...
📚 Found 100 mangas. Uploading covers...
  ✅ [1/100] One Piece...
```

#### Option B: Playwright Only Mode

Nếu **không có** FlareSolverr:

```bash
# Set FLARESOLVERR_URL to invalid để force Playwright
set FLARESOLVERR_URL=http://localhost:9999/v1

node index.js
```

Expected output:
```
⚠️ FlareSolverr not available, will use Playwright fallback
☁️ Cloud-Only Mode: MongoDB + ImageKit
🌍 Crawling home page...
🎭 Using Playwright fallback...
```

### 4. Crawl một chapter cụ thể

```bash
# Syntax: node crawl-chapter.js <manga-id> <chapter-id>

node crawl-chapter.js "one-piece" "chuong-1050"
```

## 🔍 Troubleshooting

### FlareSolverr timeout
```bash
# Tăng timeout trong code hoặc restart FlareSolverr
docker restart <container-id>
```

### Playwright browser không tìm thấy
```bash
# Re-install browsers
npx playwright install chromium --force
```

### MongoDB connection error
```bash
# Check .env file
cat ../backend/.env | grep MONGODB_URI

# Test connection
mongosh "your-mongodb-uri"
```

### ImageKit upload error
```bash
# Check credentials
cat ../backend/.env | grep IMAGEKIT

# Test with sample upload
node -e "const ImageKit = require('imagekit'); const ik = new ImageKit({...}); console.log('OK');"
```

## 📊 Expected Performance

| Task | Time | Notes |
|------|------|-------|
| Home crawl (100 manga) | 2-3 min | With cover uploads |
| Manga detail | 10-20s | Per manga |
| Chapter (50 images) | 1-3 min | Parallel upload |

## ✅ Checklist trước khi chạy

- [ ] `npm install` đã chạy xong
- [ ] Playwright browsers đã installed
- [ ] MongoDB đang chạy / có connection string
- [ ] ImageKit credentials đã config
- [ ] FlareSolverr server đang chạy (optional)
- [ ] `.env` file đã có đủ thông tin

## 📝 Environment Variables (.env)

Tạo file `../backend/.env` hoặc `.env`:

```env
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/manga-verse

# ImageKit
IMAGEKIT_PUBLIC_KEY=public_xxx
IMAGEKIT_PRIVATE_KEY=private_xxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# FlareSolverr (optional)
FLARESOLVERR_URL=http://localhost:8191/v1
# Hoặc dùng cloud:
# FLARESOLVERR_URL=https://vuthanhdat2k3-flaresolverr.hf.space/v1
```

## 🎯 Usage Examples

### Full crawl workflow

```bash
# Step 1: Crawl home page + all manga details
node index.js

# Step 2: Lazy crawl chapters on-demand
# (Thường được trigger từ API khi user request)
node crawl-chapter.js "manga-id" "chapter-id"
```

### Check what's in database

```javascript
// test.js
const mongoose = require('mongoose');
const Manga = require('../backend/models/Manga');

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    const count = await Manga.countDocuments();
    console.log(`Total mangas: ${count}`);
    
    const sample = await Manga.findOne();
    console.log('Sample:', sample.title, `(${sample.chapters.length} chapters)`);
    
    process.exit(0);
}

check();
```

```bash
node test.js
```

## 🐛 Debug Mode

Chạy với debug logs:

```bash
# Enable verbose logging
DEBUG=* node index.js

# Playwright debug
PWDEBUG=1 node index.js
```

## 🔄 Re-crawl

Nếu muốn crawl lại:

```bash
# Xóa browser profile để reset cookies
rm -rf browser_profile

# Chạy lại
node index.js
```

## 📚 Next Steps

Sau khi crawl xong:

1. Check MongoDB xem có data chưa
2. Check ImageKit xem có ảnh chưa
3. Test API endpoints của backend
4. Test frontend render
5. Crawl thêm chapters on-demand

## 💡 Tips

- **Production**: Dùng FlareSolverr (reliable hơn, ít bị block)
- **Development**: Dùng Playwright (dễ debug)
- **CI/CD**: Dùng FlareSolverr cloud instance
- **Vercel/Serverless**: Cần thêm CloudScraper logic (tham khảo Python)

## 🆘 Support

Xem thêm:
- `README.md` - Full documentation
- `COMPARISON.md` - Python vs Node.js comparison
- `REFACTOR_SUMMARY.md` - What changed

Nếu vẫn gặp issue, check logs và xác định:
1. Đang dùng mode nào (FlareSolverr/Playwright)?
2. Error ở bước nào (fetch HTML / download image / upload)?
3. Network có issue không?

---

**Happy Crawling!** 🎌
