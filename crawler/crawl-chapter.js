require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });

// ⚠️ CRITICAL: Must use the SAME mongoose instance as the models
// Models in ../backend/models/ require mongoose from ../backend/node_modules
const mongoose = require('../backend/node_modules/mongoose');

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
        // If already connected, verify it's stable
        if (mongoose.connection.readyState === 1) {
            // Wait a tiny bit to ensure stable
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log("✅ DB Already Connected");
            return;
        }

        // Connect with fail-fast config
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/manga-verse', {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
        });

        // ALWAYS wait for 'connected' event to be sure
        if (mongoose.connection.readyState !== 1) {
            console.log('⏳ Waiting for connection to stabilize...');
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Connection stabilization timeout')), 30000);
                mongoose.connection.once('connected', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                mongoose.connection.once('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });
        }

        // Extra wait to ensure connection is truly stable
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log("✅ DB Connected");
    } catch (error) {
        console.error("❌ DB Connection Error:", error.message);
        process.exit(1);
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
        // Use regular launch instead of launchPersistentContext for server compatibility
        browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--hide-scrollbars',
                '--mute-audio',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-component-extensions-with-background-pages',
                '--disable-extensions',
                '--disable-features=Translate',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--enable-features=NetworkService,NetworkServiceInProcess'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        
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
        
        return { html, page, browser, context };
    } catch (error) {
        if (browser) await browser.close();
        console.error('❌ Playwright error:', error.message);
        return null;
    }
}

/**
 * Download a single image via FlareSolverr proxy (bypasses CDN protection)
 */
async function downloadImageViaFlaresolverr(imgUrl) {
    try {
        const response = await axios.post(FLARESOLVERR_URL, {
            cmd: 'request.get',
            url: imgUrl,
            maxTimeout: 30000,
            returnRawHtml: true
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 35000
        });

        if (response.data.status === 'ok') {
            const solution = response.data.solution;
            // FlareSolverr returns the response as text, we need to check if it's base64 or raw
            if (solution.response) {
                // The response might be base64 encoded or raw HTML
                // For binary content, FlareSolverr returns base64
                return solution.response;
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Download chapter images via FlareSolverr (download each image through proxy)
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
    
    console.log(`☁️ Found ${imgElements.length} images. Downloading...`);
    
    const folderPath = `/manga_verse/${mangaId}/${chapterId}`;
    
    // Get the page domain for Referer
    const pageDomain = new URL(chapterUrl).origin;
    
    // Simple headers that mimic a real browser image request
    // CDN anti-hotlink usually only checks Referer
    const baseHeaders = {
        'User-Agent': result.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
    
    // Download and upload with retry logic for different Referer patterns
    async function downloadAndUpload(src, idx) {
        try {
            // Ensure absolute URL
            let imgUrl = src;
            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            if (!imgUrl.startsWith('http')) return null;
            
            // Try to download with axios first
            for (const referer of referersToTry) {
                try {
                    const headers = { ...baseHeaders };
                    if (referer) headers['Referer'] = referer;
                    
                    response = await axios.get(imgUrl, {
                        responseType: 'arraybuffer',
                        headers,
                        timeout: 20000,
                        maxRedirects: 5,
                        validateStatus: (status) => status < 500
                    });
                    
                    if (response.status === 200 && response.data && response.data.byteLength > 1000) {
                        break; 
                    } else {
                        lastError = `Status ${response.status}`;
                        response = null;
                    }
                } catch (e) {
                    lastError = e.message;
                    response = null;
                }
            }
            
            // If axios failed, try FlareSolverr proxy as last resort
            if (!response && flareSolverrAvailable) {
                console.log(`  🔄 Image ${idx} blocked (${lastError}). Trying FlareSolverr proxy...`);
                try {
                     const proxyResponse = await axios.post(FLARESOLVERR_URL, {
                        cmd: 'request.get',
                        url: imgUrl,
                        maxTimeout: 30000,
                        // Important: Tell FlareSolverr this is binary mostly
                    }, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 35000
                    });

                    if (proxyResponse.data.status === 'ok' && proxyResponse.data.solution) {
                        const sol = proxyResponse.data.solution;
                        // FlareSolverr tries to decode response. 
                        // If it's an image, it might be in 'response' field as internal text rep, or we can't get it easily.
                        // BUT, newer FlareSolverr versions might return it base64 if it detects binary.
                        // Let's check.
                        
                        // If this creates issue, we might need a real proxy.
                        // For now let's hope axios works for most cases, invalidating this block if it causes 500.
                        // Actually, let's SKIP FlareSolverr proxy if it caused 500s before.
                        // User reported 500s. It means FlareSolverr crashed/errored on binary.
                        
                        // ALTERNATIVE: Use Cloudscraper logic if possible? No python here.
                        
                        // Let's return null to fail fast.
                        console.log(`  ❌ Proxy attempt skipped (unreliable).`);
                    }
                } catch (pe) {
                    console.log(`  ❌ Proxy error: ${pe.message}`);
                }
            }
            
            if (!response || !response.data || response.data.byteLength < 1000) {
                console.error(`  ❌ Image ${idx} failed. Last Error: ${lastError}`);
                return null;
            }
            
            // Upload to ImageKit
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
    
    // Process in batches of 4
    const urls = new Array(imgElements.length).fill(null);
    let completed = 0;
    const BATCH_SIZE = 4;
    
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
                headers: { 'Referer': chapterUrl }
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
