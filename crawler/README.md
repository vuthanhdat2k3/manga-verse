# Manga Crawler - Dual Mode (FlareSolverr + Playwright)

Crawler này đã được viết lại hoàn toàn để phản ánh logic của Python crawler gốc.

## ✨ Tính năng

### 🔄 Dual Bypass Mode
- **FlareSolverr** (Ưu tiên): Bypass Cloudflare qua API server
- **Playwright** (Fallback): Bypass qua browser headless khi FlareSolverr không khả dụng

### 📊 Chapter Pattern Detection
- Tự động phát hiện pattern của chapter URLs
- Generate đầy đủ tất cả chapters từ 0 → max
- Fallback về visible chapters nếu không detect được pattern

### ☁️ Cloud-First Architecture
- **MongoDB**: Lưu trữ metadata (manga, chapters)
- **ImageKit**: Lưu trữ ảnh (covers + chapter images)
- Không sử dụng local storage

### ⚡ Parallel Processing
- Upload covers song song (batch size: 5)
- Download + Upload chapter images song song (batch size: 8)
- Sử dụng cookies từ FlareSolverr cho requests

## 🚀 Cách sử dụng

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Cấu hình môi trường
Tạo file `.env` hoặc sử dụng `../backend/.env`:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/manga-verse

# ImageKit
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# FlareSolverr (optional, sẽ fallback về Playwright nếu không có)
FLARESOLVERR_URL=http://localhost:8191/v1
```

### 3. Chạy crawler

#### Crawl trang chủ + tất cả manga details
```bash
node index.js
```

Lệnh này sẽ:
1. Crawl danh sách manga từ trang chủ
2. Upload tất cả covers lên ImageKit
3. Crawl chi tiết từng manga (description, author, genres, chapters)
4. Detect pattern và generate full chapter list
5. Lưu tất cả vào MongoDB

#### Crawl một chapter cụ thể (Lazy Loading)
```bash
node crawl-chapter.js <manga-id> <chapter-id>
```

Ví dụ:
```bash
node crawl-chapter.js "one-piece" "chuong-1050"
```

Lệnh này sẽ:
1. Lấy chapter URL từ MongoDB
2. Crawl trang chapter (FlareSolverr → Playwright)
3. Download tất cả ảnh
4. Upload lên ImageKit song song
5. Lưu URLs vào MongoDB

## 🔧 Architecture

### Priority Flow

```
┌─────────────────────────────────────────┐
│         Request to crawl page           │
└──────────────┬──────────────────────────┘
               │
               ▼
       ┌───────────────┐
       │ FlareSolverr  │ ← Priority 1
       │   Available?  │
       └───────┬───────┘
               │
        Yes ───┼─── No
        │              │
        ▼              ▼
   ┌─────────┐   ┌──────────┐
   │ Flare   │   │Playwright│ ← Fallback
   │ Solverr │   │  Mode    │
   └────┬────┘   └────┬─────┘
        │             │
        └──────┬──────┘
               ▼
        ┌────────────┐
        │Parse HTML  │
        │with Cheerio│
        └─────┬──────┘
              ▼
       ┌──────────────┐
       │Save to Cloud │
       │MongoDB+ImageKit│
       └──────────────┘
```

### Image Upload Flow (FlareSolverr Mode)

```
┌────────────┐
│FlareSolverr│──→ Get HTML + Cookies
└─────┬──────┘
      │
      ▼
┌─────────────────────────────────┐
│ Extract Image URLs from HTML    │
└──────────┬──────────────────────┘
           │
           ▼
     ┌─────────────────────────────────┐
     │ For each image (parallel batch): │
     │ 1. Download with cookies        │
     │ 2. Upload to ImageKit           │
     │ 3. Get cloud URL                │
     └──────────┬──────────────────────┘
                │
                ▼
         ┌──────────────┐
         │ Save URLs to │
         │   MongoDB    │
         └──────────────┘
```

### Image Upload Flow (Playwright Mode)

```
┌──────────┐
│Playwright│──→ Launch browser + Get HTML
└────┬─────┘
     │
     ▼
┌─────────────────────┐
│ Scroll to load lazy │
│ loaded images       │
└──────┬──────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Download images via page.request │
│ (includes proper referer)        │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────┐
│Close browser │
└──────┬───────┘
       │
       ▼
┌───────────────────────────┐
│ Upload to ImageKit        │
│ (parallel, batch of 8)    │
└──────┬────────────────────┘
       │
       ▼
┌──────────────┐
│ Save URLs to │
│   MongoDB    │
└──────────────┘
```

## 📁 File Structure

```
crawler/
├── index.js              # Main crawler (home + manga details)
├── crawl-chapter.js      # Chapter crawler (lazy loading)
├── package.json          # Dependencies
├── README.md            # This file
└── browser_profile/     # Playwright persistent context (auto-created)
```

## 🔍 So sánh với Python version

| Feature | Python Crawler | Node.js Crawler |
|---------|---------------|-----------------|
| FlareSolverr | ✅ Priority 1 | ✅ Priority 1 |
| Playwright | ✅ Fallback | ✅ Fallback |
| CloudScraper | ✅ Có (cho Vercel) | ❌ Không cần |
| Pattern Detection | ✅ | ✅ |
| Parallel Upload | ✅ ThreadPoolExecutor | ✅ Promise.all |
| Cookie Handling | ✅ | ✅ |
| Cloud Storage | ✅ MongoDB + ImageKit | ✅ MongoDB + ImageKit |

## 🛠️ Dependencies

```json
{
  "axios": "Requests library",
  "cheerio": "HTML parsing (như BeautifulSoup)",
  "playwright": "Browser automation (fallback)",
  "mongoose": "MongoDB ODM",
  "imagekit": "ImageKit cloud storage",
  "dotenv": "Environment variables"
}
```

## 📝 Notes

- Crawler tự động check FlareSolverr availability khi khởi động
- Nếu FlareSolverr không available, sẽ tự động dùng Playwright
- Browser profile được lưu tại `./browser_profile` để tránh Cloudflare challenge
- Tất cả URLs được normalize về absolute trước khi gửi request
- Chapter pattern detection hỗ trợ: `chuong-N`, `chap-N`, `chapter-N`

## 🔧 Troubleshooting

### FlareSolverr timeout
- Tăng `maxTimeout` trong code (mặc định 60s)
- Hoặc để fallback về Playwright

### Playwright bị Cloudflare block
- Xóa `browser_profile` folder và chạy lại
- Giảm `headless: false` để debug

### Ảnh bị lỗi 403
- Check cookies đã được set đúng chưa
- Check referer header đã có chưa

## 📊 Performance

- **Home crawl**: ~2-3 phút (100 manga)
- **Manga detail**: ~10-20s mỗi manga
- **Chapter download**: ~1-3 phút (30-50 ảnh)

## 🎯 Future Improvements

- [ ] Retry logic cho từng ảnh fail
- [ ] Progress bar đẹp hơn
- [ ] Crawl incremental (chỉ update manga mới)
- [ ] Rate limiting configurable
- [ ] Docker support
