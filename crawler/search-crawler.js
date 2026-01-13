require('dotenv').config({ path: '../backend/.env' });
const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const Manga = require('../backend/models/Manga');
const ImageKit = require('imagekit');
const { chromium } = require('playwright');

// Configuration
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'https://vuthanhdat2k3-flaresolverr.hf.space/v1';
const BASE_URL = "https://halcyonhomecare.co.uk";
const USER_DATA_DIR = "./browser_profile";

// Initialize ImageKit
const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'placeholder',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'placeholder',
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'placeholder'
});

let flareSolverrAvailable = false;
let flareSolverrCookies = [];
let flareSolverrUserAgent = '';

async function connectDB() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/manga-verse');
        console.log("✅ DB Connected");
    }
}

async function checkFlareSolverr() {
    try {
        const response = await axios.get(FLARESOLVERR_URL.replace('/v1', '/'), { timeout: 5000 });
        if (response.status === 200) {
            flareSolverrAvailable = true;
            return true;
        }
    } catch (e) {
        // Silent fail
    }
    flareSolverrAvailable = false;
    return false;
}

async function solveWithFlaresolverr(url) {
    try {
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
        }
    } catch (error) {
        console.error(`FlareSolverr failed:`, error.message);
    }
    return null;
}

async function solveWithPlaywright(url) {
    let browser = null;
    
    try {
        browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
            headless: true,
            args: ['--disable-blink-features=AutomationControlled'],
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        });
        
        const page = await browser.newPage();
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        });
        
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        
        const title = await page.title();
        if (title.includes('Just a moment') || title.includes('Cloudflare')) {
            await page.waitForTimeout(8000);
        }
        
        const html = await page.content();
        await browser.close();
        
        return { html };
    } catch (error) {
        if (browser) await browser.close();
        console.error('Playwright error:', error.message);
        return null;
    }
}

async function solve(url) {
    if (flareSolverrAvailable) {
        const result = await solveWithFlaresolverr(url);
        if (result && result.html) {
            return result.html;
        }
    }
    
    const result = await solveWithPlaywright(url);
    if (result && result.html) {
        return result.html;
    }
    
    throw new Error('All bypass methods failed');
}

async function uploadImageViaRequests(url, fileName) {
    if (!process.env.IMAGEKIT_PRIVATE_KEY) return url;
    if (!url || url.includes('loader') || url.includes('error')) return url;
    
    if (url.startsWith('//')) url = 'https:' + url;
    if (!url.startsWith('http')) return url;

    try {
        const headers = {
            'User-Agent': flareSolverrUserAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': BASE_URL,
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        };
        
        if (flareSolverrCookies.length > 0) {
            headers['Cookie'] = flareSolverrCookies.map(c => `${c.name}=${c.value}`).join('; ');
        }
        
        const imageResponse = await axios.get(url, {
            responseType: 'arraybuffer',
            headers,
            timeout: 30000
        });

        if (!imageResponse.data || imageResponse.data.byteLength < 1000) {
            return url;
        }

        const base64Image = Buffer.from(imageResponse.data).toString('base64');
        
        const result = await imagekit.upload({
            file: base64Image,
            fileName: fileName,
            folder: '/manga_verse/covers',
            useUniqueFileName: false
        });
        
        return result.url;
    } catch (e) {
        console.error(`Upload error for ${fileName}:`, e.message);
        return url;
    }
}

const ensureAbsolute = (url) => {
    if (!url) return url;
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    return BASE_URL + (url.startsWith('/') ? '' : '/') + url;
};

/**
 * Search for manga on NetTruyen
 * @param {string} keyword - Search keyword
 * @returns {Array} - List of search results
 */
async function searchManga(keyword) {
    await connectDB();
    await checkFlareSolverr();
    
    console.log(`🔍 Searching for: "${keyword}"`);
    
    try {
        // NetTruyen search URL
        const searchUrl = `${BASE_URL}/tim-truyen?keyword=${encodeURIComponent(keyword)}`;
        const html = await solve(searchUrl);
        const $ = cheerio.load(html);

        const results = [];
        $('.item').each((i, el) => {
            const titleEl = $(el).find('h3 a');
            const imgEl = $(el).find('img');
            const latestChapterEl = $(el).find('.chapter a').first();
            
            if (titleEl.length) {
                const absUrl = ensureAbsolute(titleEl.attr('href'));
                const thumbnail = imgEl.attr('data-original') || imgEl.attr('data-src') || imgEl.attr('src');
                
                results.push({
                    id: absUrl.split('/').pop(),
                    title: titleEl.text().trim(),
                    url: absUrl,
                    thumbnail: ensureAbsolute(thumbnail),
                    latest_chapter: latestChapterEl.text().trim() || 'N/A'
                });
            }
        });

        console.log(`✅ Found ${results.length} results`);
        return results;
    } catch (error) {
        console.error('Search error:', error.message);
        throw error;
    }
}

/**
 * Crawl manga from URL
 * @param {string} url - Full URL or manga ID
 * @returns {Object} - Crawled manga data
 */
async function crawlFromUrl(url) {
    await connectDB();
    await checkFlareSolverr();
    
    // Extract manga ID from URL
    let mangaId = url;
    if (url.includes('nettruyen') || url.includes('/')) {
        const parts = url.split('/');
        mangaId = parts[parts.length - 1] || parts[parts.length - 2];
    }
    
    console.log(`📖 Crawling manga: ${mangaId}`);
    
    try {
        const mangaUrl = url.startsWith('http') ? url : `${BASE_URL}/truyen-tranh/${mangaId}`;
        const html = await solve(mangaUrl);
        const $ = cheerio.load(html);

        // Parse manga details
        const title = $('h1.title-detail').text().trim();
        const desc = $('.detail-content p').first().text().trim();
        const author = $('.author .col-xs-8').text().trim() || 'Unknown';
        const status = $('.status .col-xs-8').text().trim() || 'Unknown';
        
        const genres = [];
        $('.kind p a').each((i, el) => genres.push($(el).text()));

        // Get thumbnail
        const thumbEl = $('.col-image img');
        let thumbnail = thumbEl.attr('data-original') || thumbEl.attr('data-src') || thumbEl.attr('src');
        thumbnail = ensureAbsolute(thumbnail);
        
        // Upload cover
        console.log('☁️ Uploading cover...');
        const uploadedCover = await uploadImageViaRequests(thumbnail, `${mangaId}.jpg`);

        console.log('📜 Analyzing chapters...');

        // Chapters Analysis
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

        // Pattern detection
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
        
        if (pattern && maxChapter > 0) {
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
            chapters = visibleChapters;
            console.log(`   ⚠️ No pattern. Saved ${chapters.length} visible chapters.`);
        }
        
        const mangaData = {
            id: mangaId,
            title: title,
            url: mangaUrl,
            description: desc,
            thumbnail: uploadedCover,
            author: author,
            status: status,
            genres: genres,
            chapters: chapters,
            total_chapters: chapters.length
        };
        
        // Save to DB
        await Manga.findOneAndUpdate(
            { id: mangaId },
            { $set: mangaData },
            { upsert: true, new: true }
        );
        
        console.log(`☁️ Saved "${title}" with ${chapters.length} chapters to MongoDB`);
        
        return mangaData;
    } catch (error) {
        console.error('Crawl error:', error.message);
        throw error;
    }
}

// Export functions
module.exports = {
    searchManga,
    crawlFromUrl
};

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'search' && args[1]) {
        searchManga(args[1]).then(results => {
            console.log('\nResults:');
            results.forEach((r, i) => {
                console.log(`${i + 1}. ${r.title} (${r.id})`);
            });
            process.exit(0);
        }).catch(err => {
            console.error(err);
            process.exit(1);
        });
    } else if (command === 'crawl' && args[1]) {
        crawlFromUrl(args[1]).then(manga => {
            console.log(`\n✅ Successfully crawled: ${manga.title}`);
            process.exit(0);
        }).catch(err => {
            console.error(err);
            process.exit(1);
        });
    } else {
        console.log(`
Usage:
  node search-crawler.js search <keyword>
  node search-crawler.js crawl <url-or-manga-id>

Examples:
  node search-crawler.js search "one piece"
  node search-crawler.js crawl "https://nettruyen.me.uk/truyen-tranh/one-piece"
  node search-crawler.js crawl "one-piece"
        `);
        process.exit(1);
    }
}
