require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const mongoose = require('mongoose');

// ⚠️ CRITICAL: Disable buffering BEFORE requiring models
// Models inherit this config when they are created
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 30000);

const axios = require('axios');
const cheerio = require('cheerio');
const Manga = require('../backend/models/Manga');
const ChapterDetail = require('../backend/models/ChapterDetail');
const ImageKit = require('imagekit');
const { chromium } = require('playwright');

// Configuration
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'https://vuthanhdat2k3-flaresolverr.hf.space/v1';
const BASE_URL = "https://nettruyen.me.uk";
const USER_DATA_DIR = "./browser_profile";

// Initialize ImageKit
const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'placeholder',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'placeholder',
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'placeholder'
});

// Connection state
let flareSolverrAvailable = false;
let flareSolverrCookies = [];
let flareSolverrUserAgent = '';

async function connectDB() {
    try {
        // If already connected, skip
        if (mongoose.connection.readyState === 1) {
            console.log("✅ DB Already Connected");
            return;
        }

        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/manga-verse', {
            serverSelectionTimeoutMS: 30000, // 30 seconds timeout for initial connection
            socketTimeoutMS: 45000,          // 45 seconds socket timeout
            bufferCommands: false,           // Disable buffering - fail fast instead of timeout
        });

        // Wait for connection to be fully ready
        if (mongoose.connection.readyState !== 1) {
            await new Promise((resolve, reject) => {
                mongoose.connection.once('connected', resolve);
                mongoose.connection.once('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 30000);
            });
        }

        console.log("✅ DB Connected");
    } catch (error) {
        console.error("❌ DB Connection Error:", error.message);
        process.exit(1); // Exit immediately on connection failure
    }
}

/**
 * Check if FlareSolverr is available
 */
async function checkFlareSolverr() {
    try {
        const response = await axios.get(FLARESOLVERR_URL.replace('/v1', '/'), { timeout: 5000 });
        if (response.status === 200) {
            flareSolverrAvailable = true;
            console.log('✅ FlareSolverr available');
            return true;
        }
    } catch (e) {
        console.log('⚠️ FlareSolverr not available');
    }
    flareSolverrAvailable = false;
    return false;
}

/**
 * Fetch HTML using FlareSolverr
 */
async function solveWithFlaresolverr(url) {
    try {
        console.log('🔓 Bypassing Cloudflare via FlareSolverr...');
        
        const response = await axios.post(FLARESOLVERR_URL, {
            cmd: 'request.get',
            url: url,
            maxTimeout: 60000
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 70000
        });

        if (response.data.status === 'ok') {
            const solution = response.data.solution;
            flareSolverrCookies = solution.cookies || [];
            flareSolverrUserAgent = solution.userAgent || '';
            
            return {
                html: solution.response,
                cookies: flareSolverrCookies,
                userAgent: flareSolverrUserAgent
            };
        } else {
            throw new Error(`FlareSolverr error: ${response.data.message}`);
        }
    } catch (error) {
        console.error(`❌ FlareSolverr failed:`, error.message);
        return null;
    }
}

/**
 * Fetch HTML using Playwright (fallback)
 */
async function solveWithPlaywright(url) {
    console.log('🎭 Using Playwright...');
    let browser = null;
    
    try {
        browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
            headless: true,
            args: ['--disable-blink-features=AutomationControlled'],
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        });
        
        const page = await browser.newPage();
        
        // Anti-detection
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        });
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Check for Cloudflare
        const title = await page.title();
        if (title.includes('Just a moment') || title.includes('Cloudflare')) {
            console.log('  🛡️ Detected Cloudflare, waiting...');
            await page.waitForTimeout(8000);
        }
        
        // Scroll to trigger lazy loading
        console.log('📜 Triggering lazy loading...');
        for (let i = 0; i < 10; i++) {
            await page.mouse.wheel(0, 1000);
            await page.waitForTimeout(800);
        }
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(2000);
        
        const html = await page.content();
        
        return { html, page, browser };
    } catch (error) {
        if (browser) await browser.close();
        console.error('❌ Playwright error:', error.message);
        return null;
    }
}

/**
 * Download chapter images via FlareSolverr (parallel download + upload)
 */
async function downloadChapterViaFlaresolverr(mangaId, chapterId, chapterUrl) {
    const result = await solveWithFlaresolverr(chapterUrl);
    if (!result || !result.html) {
        console.log('❌ FlareSolverr could not fetch page');
        return [];
    }
    
    const $ = cheerio.load(result.html);
    
    // Find all images
    const imgElements = [];
    $('.reading-detail img, .page-chapter img, .reading img').each((i, el) => {
        const src = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src');
        if (src) imgElements.push(src);
    });
    
    if (imgElements.length === 0) {
        console.log('⚠️ No images found');
        return [];
    }
    
    console.log(`☁️ Found ${imgElements.length} images. Download + Upload in parallel...`);
    
    const folderPath = `/manga_verse/${mangaId}/${chapterId}`;
    
    // Prepare headers with FlareSolverr cookies
    const headers = {
        'User-Agent': result.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': BASE_URL,
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
    };
    
    if (result.cookies.length > 0) {
        headers['Cookie'] = result.cookies.map(c => `${c.name}=${c.value}`).join('; ');
    }
    
    // Download and upload in parallel (combined task)
    async function downloadAndUpload(src, idx) {
        try {
            // Ensure absolute URL
            let imgUrl = src;
            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            if (!imgUrl.startsWith('http')) return null;
            
            // Download
            const response = await axios.get(imgUrl, {
                responseType: 'arraybuffer',
                headers,
                timeout: 30000
            });
            
            if (!response.data || response.data.byteLength < 1000) {
                return null;
            }
            
            // Upload immediately
            const base64Image = Buffer.from(response.data).toString('base64');
            const filename = `${String(idx).padStart(3, '0')}.jpg`;
            
            const uploadResult = await imagekit.upload({
                file: base64Image,
                fileName: filename,
                folder: folderPath,
                useUniqueFileName: false
            });
            
            return { idx, url: uploadResult.url };
        } catch (e) {
            console.error(`  ❌ Image ${idx} error:`, e.message);
            return null;
        }
    }
    
    // Process in batches of 8
    const urls = new Array(imgElements.length).fill(null);
    const BATCH_SIZE = 8;
    let completed = 0;
    
    for (let i = 0; i < imgElements.length; i += BATCH_SIZE) {
        const batch = imgElements.slice(i, Math.min(i + BATCH_SIZE, imgElements.length));
        const results = await Promise.all(
            batch.map((src, batchIdx) => downloadAndUpload(src, i + batchIdx))
        );
        
        results.forEach(result => {
            if (result) {
                urls[result.idx] = result.url;
                completed++;
                console.log(`  ☁️ [${completed}/${imgElements.length}] Downloaded + Uploaded`);
            }
        });
    }
    
    // Filter out nulls
    const finalUrls = urls.filter(url => url !== null);
    console.log(`✅ Completed ${finalUrls.length}/${imgElements.length} images`);
    
    return finalUrls;
}

/**
 * Download chapter images via Playwright (parallel download + upload)
 */
async function downloadChapterViaPlaywright(mangaId, chapterId, chapterUrl) {
    const result = await solveWithPlaywright(chapterUrl);
    if (!result || !result.html) {
        console.log('❌ Playwright could not fetch page');
        return [];
    }
    
    const { html, page, browser } = result;
    const $ = cheerio.load(html);
    
    // Find all images
    const imgElements = [];
    $('.reading-detail img, .page-chapter img, .reading img').each((i, el) => {
        const src = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src');
        if (src) imgElements.push(src);
    });
    
    if (imgElements.length === 0) {
        await browser.close();
        console.log('⚠️ No images found');
        return [];
    }
    
    console.log(`☁️ Found ${imgElements.length} images. Downloading via Playwright...`);
    
    // Download all images first
    const downloaded = {};
    for (let idx = 0; idx < imgElements.length; idx++) {
        try {
            let src = imgElements[idx];
            if (src.startsWith('//')) src = 'https:' + src;
            if (!src.startsWith('http')) continue;
            
            const response = await page.request.get(src, {
                headers: { 'Referer': BASE_URL + '/' }
            });
            
            if (response.status() === 200) {
                const imageBuffer = await response.body();
                if (imageBuffer.length > 1000) {
                    downloaded[idx] = imageBuffer;
                    console.log(`  📥 Downloaded [${Object.keys(downloaded).length}/${imgElements.length}]`);
                }
            }
        } catch (e) {
            console.error(`  ❌ Download error ${idx}:`, e.message);
        }
    }
    
    await browser.close();
    
    // Upload in parallel
    if (Object.keys(downloaded).length > 0) {
        console.log(`☁️ Uploading ${Object.keys(downloaded).length} images...`);
        
        const folderPath = `/manga_verse/${mangaId}/${chapterId}`;
        
        async function uploadOne(idx, imageBuffer) {
            try {
                const base64Image = imageBuffer.toString('base64');
                const filename = `${String(idx).padStart(3, '0')}.jpg`;
                
                const result = await imagekit.upload({
                    file: base64Image,
                    fileName: filename,
                    folder: folderPath,
                    useUniqueFileName: false
                });
                
                return { idx, url: result.url };
            } catch (e) {
                console.error(`  ❌ Upload error ${idx}:`, e.message);
                return null;
            }
        }
        
        const urls = new Array(imgElements.length).fill(null);
        const BATCH_SIZE = 8;
        let uploadCount = 0;
        
        const entries = Object.entries(downloaded);
        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, Math.min(i + BATCH_SIZE, entries.length));
            const results = await Promise.all(
                batch.map(([idx, buffer]) => uploadOne(parseInt(idx), buffer))
            );
            
            results.forEach(result => {
                if (result) {
                    urls[result.idx] = result.url;
                    uploadCount++;
                    console.log(`  ☁️ Uploaded [${uploadCount}/${Object.keys(downloaded).length}]`);
                }
            });
        }
        
        return urls.filter(url => url !== null);
    }
    
    return [];
}

/**
 * Main function to crawl a chapter
 */
async function crawlChapter(mangaId, chapterId) {
    await connectDB();
    await checkFlareSolverr();

    try {
        // Check if already crawled
        const existing = await ChapterDetail.findOne({ manga_id: mangaId, chapter_id: chapterId });
        if (existing && existing.images && existing.images.length > 0) {
            console.log(`⏭️ Chapter already crawled (${existing.images.length} images)`);
            process.exit(0);
        }
        
        // Get manga info to find chapter URL
        const manga = await Manga.findOne({ id: mangaId });
        if (!manga) {
            console.error("❌ Manga not found");
            process.exit(1);
        }

        const chapter = manga.chapters.find(c => c.id === chapterId);
        if (!chapter) {
            console.error("❌ Chapter not found in manga metadata");
            process.exit(1);
        }

        console.log(`🚀 Crawling ${mangaId} - ${chapter.title}...`);
        
        const ensureAbsolute = (url) => {
            if (!url) return url;
            if (url.startsWith('http')) return url;
            if (url.startsWith('//')) return 'https:' + url;
            return BASE_URL + (url.startsWith('/') ? '' : '/') + url;
        };
        
        const absoluteUrl = ensureAbsolute(chapter.url);
        let images = [];
        
        // Try FlareSolverr first
        if (flareSolverrAvailable) {
            images = await downloadChapterViaFlaresolverr(mangaId, chapterId, absoluteUrl);
            if (images.length > 0) {
                // Save to DB
                await ChapterDetail.findOneAndUpdate(
                    { manga_id: mangaId, chapter_id: chapterId },
                    { 
                        images: images, 
                        updated_at: new Date(),
                        $setOnInsert: { created_at: new Date() }
                    },
                    { upsert: true }
                );
                console.log(`☁️ Saved ${images.length} URLs to MongoDB (via FlareSolverr)`);
                process.exit(0);
            }
            console.log('⚠️ FlareSolverr failed, trying Playwright...');
        }
        
        // Fallback to Playwright
        images = await downloadChapterViaPlaywright(mangaId, chapterId, absoluteUrl);
        
        if (images.length > 0) {
            await ChapterDetail.findOneAndUpdate(
                { manga_id: mangaId, chapter_id: chapterId },
                { 
                    images: images, 
                    updated_at: new Date(),
                    $setOnInsert: { created_at: new Date() }
                },
                { upsert: true }
            );
            console.log(`☁️ Saved ${images.length} URLs to MongoDB (via Playwright)`);
        } else {
            console.log('❌ No images could be downloaded');
        }

    } catch (e) {
        console.error(`❌ Error:`, e.message);
    } finally {
        process.exit(0);
    }
}

// CLI usage: node crawl-chapter.js <mangaId> <chapterId>
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Usage: node crawl-chapter.js <mangaId> <chapterId>");
    process.exit(1);
}

crawlChapter(args[0], args[1]);
