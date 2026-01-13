require('dotenv').config({ path: '../backend/.env' });
const mongoose = require('../backend/node_modules/mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const Manga = require('../backend/models/Manga');
const ChapterDetail = require('../backend/models/ChapterDetail');
const ImageKit = require('imagekit');
const { chromium } = require('playwright');

// Configuration
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'https://vuthanhdat2k3-flaresolverr.hf.space/v1';
const BASE_URL = "https://halcyonhomecare.co.uk";
const HOME_URL = "https://halcyonhomecare.co.uk/trang-chu";
const USER_DATA_DIR = "./browser_profile";

console.log(`🚀 FlareSolverr URL: ${FLARESOLVERR_URL}`);
console.log(`🎭 Playwright Mode: Enabled`);

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
    mongoose.connection.on('connected', () => console.log('✅ Mongoose connected'));
    mongoose.connection.on('error', (err) => console.log('❌ Mongoose connection error:', err));
    mongoose.connection.on('disconnected', () => console.log('⚠️ Mongoose disconnected'));

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/manga-verse');
    console.log("☁️ Cloud-Only Mode: MongoDB + ImageKit");
}

/**
 * Check if FlareSolverr is available
 */
async function checkFlareSolverr() {
    try {
        const response = await axios.get(FLARESOLVERR_URL.replace('/v1', '/'), { timeout: 5000 });
        if (response.status === 200) {
            flareSolverrAvailable = true;
            console.log('✅ FlareSolverr connected');
            return true;
        }
    } catch (e) {
        console.log('⚠️ FlareSolverr not available, will use Playwright fallback');
    }
    flareSolverrAvailable = false;
    return false;
}

/**
 * Fetch HTML using FlareSolverr with retry logic
 */
async function solveWithFlaresolverr(url, retries = 2) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            if (attempt > 1) console.log(`   🔄 FlareSolverr retry ${attempt}/${retries + 1}...`);
            
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
                // Save cookies for later requests
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
            const isLastAttempt = attempt === retries + 1;
            
            if (isLastAttempt) {
                console.error(`❌ FlareSolverr failed after ${retries + 1} attempts:`, error.message);
                return null;
            }
            
            const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
            console.log(`   ⏳ Waiting ${delay/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
}

/**
 * Fetch HTML using Playwright (fallback)
 */
async function solveWithPlaywright(url) {
    console.log('🎭 Using Playwright fallback...');
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
        
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        
        // Check for Cloudflare challenge
        const title = await page.title();
        if (title.includes('Just a moment') || title.includes('Cloudflare')) {
            console.log('  🛡️ Detected Cloudflare challenge, waiting...');
            await page.waitForTimeout(8000);
        }
        
        const html = await page.content();
        await browser.close();
        
        return { html };
    } catch (error) {
        if (browser) await browser.close();
        console.error('❌ Playwright error:', error.message);
        return null;
    }
}

/**
 * Smart solver: Try FlareSolverr first, fallback to Playwright
 */
async function solve(url) {
    // Try FlareSolverr first
    if (flareSolverrAvailable) {
        const result = await solveWithFlaresolverr(url);
        if (result && result.html) {
            return result.html;
        }
        console.log('⚠️ FlareSolverr failed, trying Playwright...');
    }
    
    // Fallback to Playwright
    const result = await solveWithPlaywright(url);
    if (result && result.html) {
        return result.html;
    }
    
    throw new Error('All bypass methods failed');
}

/**
 * Upload image to ImageKit (download via requests with cookies from FlareSolverr)
 */
async function uploadImageViaRequests(url, fileName) {
    if (!process.env.IMAGEKIT_PRIVATE_KEY) return url;
    if (!url || url.includes('loader') || url.includes('error')) return url;
    
    // Ensure absolute URL
    if (url.startsWith('//')) url = 'https:' + url;
    if (!url.startsWith('http')) return url;

    try {
        // Download with cookies from FlareSolverr
        const headers = {
            'User-Agent': flareSolverrUserAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': BASE_URL,
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        };
        
        // Add cookies
        if (flareSolverrCookies.length > 0) {
            headers['Cookie'] = flareSolverrCookies.map(c => `${c.name}=${c.value}`).join('; ');
        }
        
        const imageResponse = await axios.get(url, {
            responseType: 'arraybuffer',
            headers,
            timeout: 30000
        });

        if (!imageResponse.data || imageResponse.data.byteLength < 1000) {
            console.log(`   ⚠️ Image too small: ${fileName}`);
            return url;
        }

        // Upload to ImageKit
        const base64Image = Buffer.from(imageResponse.data).toString('base64');
        
        const result = await imagekit.upload({
            file: base64Image,
            fileName: fileName,
            folder: '/manga_verse/covers',
            useUniqueFileName: false
        });
        
        return result.url;
    } catch (e) {
        console.error(`   ❌ Upload error for ${fileName}:`, e.message);
        return url;
    }
}

/**
 * Upload image via Playwright (for when Playwright is used)
 */
async function uploadImageViaPlaywright(page, url, fileName) {
    if (!process.env.IMAGEKIT_PRIVATE_KEY) return url;
    if (!url || url.includes('loader') || url.includes('error')) return url;
    
    if (url.startsWith('//')) url = 'https:' + url;
    if (!url.startsWith('http')) return url;

    try {
        const response = await page.request.get(url, {
            headers: { 'Referer': BASE_URL + '/' }
        });
        
        if (response.status() === 200) {
            const imageBuffer = await response.body();
            
            if (imageBuffer.length < 1000) {
                console.log(`   ⚠️ Image too small: ${fileName}`);
                return url;
            }
            
            const base64Image = imageBuffer.toString('base64');
            
            const result = await imagekit.upload({
                file: base64Image,
                fileName: fileName,
                folder: '/manga_verse/covers',
                useUniqueFileName: false
            });
            
            return result.url;
        }
    } catch (e) {
        console.error(`   ❌ Upload error for ${fileName}:`, e.message);
    }
    
    return url;
}

const ensureAbsolute = (url) => {
    if (!url) return url;
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    return BASE_URL + (url.startsWith('/') ? '' : '/') + url;
};

/**
 * Crawl manga detail page and analyze chapters
 */
async function crawlManga(manga) {
    try {
        console.log(`\n📖 Processing Manga: ${manga.title}...`);
        
        const absoluteUrl = ensureAbsolute(manga.url);
        const html = await solve(absoluteUrl);
        const $ = cheerio.load(html);

        // Parse Details
        const desc = $('.detail-content p').first().text().trim();
        const author = $('.author .col-xs-8').text().trim() || 'Unknown';
        const status = $('.status .col-xs-8').text().trim() || 'Unknown';
        const genres = [];
        $('.kind p a').each((i, el) => genres.push($(el).text()));

        console.log('📜 Analyzing chapters...');

        // Chapters Analysis - CRITICAL: Use same logic as Python
        const visibleChapters = [];
        $('#nt_listchapter ul li.row:not(.heading) a').each((i, el) => {
            const absUrl = ensureAbsolute($(el).attr('href'));
            const text = $(el).text().trim();
            if (absUrl && text) {
                visibleChapters.push({
                    title: text,
                    url: absUrl,
                    id: absUrl.split('/').pop()
                });
            }
        });

        // Pattern detection to generate full chapter list
        let maxChapter = 0;
        let minChapter = Number.MAX_SAFE_INTEGER;
        let pattern = null;

        for (const chap of visibleChapters) {
            const match = chap.url.match(/[/-](chuong|chap|chapter)[/-]?(\d+)/i);
            if (match) {
                const num = parseInt(match[2], 10);
                if (!isNaN(num)) {
                    maxChapter = Math.max(maxChapter, num);
                    minChapter = Math.min(minChapter, num);

                    if (!pattern) {
                        const prefix = match[1].toLowerCase();
                        const baseUrl = chap.url.replace(new RegExp(`[/-]${prefix}[/-]?\\d+.*$`, 'i'), '');
                        pattern = {
                            baseUrl,
                            prefix,
                            separator: chap.url.toLowerCase().includes(`${prefix}-`) ? '-' : ''
                        };
                    }
                }
            }
        }

        let chapters = [];
        
        // Generate full chapter list if pattern detected
        if (pattern && maxChapter > 0) {
            // Generate from maxChapter down to 0 (same as Python)
            for (let i = maxChapter; i >= 0; i--) {
                const chapId = `${pattern.prefix}${pattern.separator}${i}`;
                const chapUrl = `${pattern.baseUrl}/${chapId}`;
                chapters.push({
                    title: `Chapter ${i}`,
                    url: ensureAbsolute(chapUrl),
                    id: chapId
                });
            }
            console.log(`   📊 Pattern detected: Chapter ${minChapter} → ${maxChapter}`);
            console.log(`   ✅ Generated ${chapters.length} chapters!`);
        } else {
            // Fallback to visible chapters only
            chapters = visibleChapters;
            console.log(`   ⚠️ No pattern detected. Saved ${chapters.length} visible chapters.`);
        }
        
        // Update Manga in database
        await Manga.findOneAndUpdate(
            { id: manga.id },
            { 
                description: desc,
                author: author,
                status: status,
                genres: genres,
                chapters: chapters,
                total_chapters: chapters.length
            }
        );
        
        console.log(`   ✅ Updated ${manga.title} (${chapters.length} chapters)`);

    } catch (e) {
        console.error(`❌ Error processing manga ${manga.title}:`, e.message);
    }
}

/**
 * Crawl home page
 */
async function crawlHome() {
    console.log("🌍 Crawling home page...");
    
    try {
        const html = await solve(HOME_URL);
        const $ = cheerio.load(html);

        const items = [];
        $('.item').each((i, el) => {
            const titleEl = $(el).find('h3 a');
            const imgEl = $(el).find('img');
            
            if (titleEl.length) {
                const absUrl = ensureAbsolute(titleEl.attr('href'));
                const thumbnail = imgEl.attr('data-original') || imgEl.attr('data-src') || imgEl.attr('src');
                
                items.push({
                    title: titleEl.text().trim(),
                    url: absUrl,
                    id: absUrl.split('/').pop(),
                    thumbnail: thumbnail
                });
            }
        });

        console.log(`\n📚 Found ${items.length} mangas. Uploading covers...`);

        // Upload covers in parallel (max 5 concurrent)
        const BATCH_SIZE = 5;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (item) => {
                const uploadedCover = await uploadImageViaRequests(item.thumbnail, `${item.id}.jpg`);
                item.thumbnail = uploadedCover;
                
                await Manga.findOneAndUpdate(
                    { id: item.id },
                    { 
                        $set: { 
                            title: item.title, 
                            url: item.url, 
                            thumbnail: item.thumbnail, 
                            updated_at: new Date() 
                        } 
                    },
                    { upsert: true }
                );
                
                console.log(`  ✅ [${i + batch.indexOf(item) + 1}/${items.length}] ${item.title.substring(0, 40)}...`);
            }));
        }
        
        console.log(`\n☁️ Saved ${items.length} mangas to MongoDB`);
        
        return items;
    } catch (error) {
        console.error("❌ Error crawling home:", error.message);
        throw error;
    }
}

/**
 * Main crawl function
 */
async function crawl() {
    await connectDB();
    await checkFlareSolverr();
    
    try {
        // Step 1: Crawl home page
        const mangas = await crawlHome();
        
        // Step 2: Crawl each manga detail
        console.log(`\n📖 Crawling manga details...`);
        for (const manga of mangas) {
            await crawlManga(manga);
        }

    } catch (error) {
        console.error("❌ Critical Error:", error);
    } finally {
        console.log("\n✅ Crawl finished.");
        process.exit(0);
    }
}

// Run crawler
crawl();
