const mongoose = require('mongoose');
const ImageKit = require('imagekit');
const Manga = require('./models/Manga');
const ChapterDetail = require('./models/ChapterDetail');
require('dotenv').config();

// Initialize ImageKit
const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

const MANGA_ID = 'yeu-than-ky'; // Target manga

async function syncChapters() {
    try {
        console.log("🔌 Connecting to DB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ DB Connected");

        // 1. Get Manga Metadata
        const manga = await Manga.findOne({ id: MANGA_ID });
        if (!manga) {
            console.error(`❌ Manga '${MANGA_ID}' not found in database.`);
            return;
        }

        console.log(`📘 Found manga: ${manga.title} with ${manga.chapters.length} chapters.`);

        let restoredCount = 0;
        let skippedCount = 0;

        // 2. Iterate through chapters
        for (const chapter of manga.chapters) {
            // Check if ChapterDetail already exists
            const existing = await ChapterDetail.findOne({ manga_id: MANGA_ID, chapter_id: chapter.id });
            if (existing && existing.images && existing.images.length > 0) {
                process.stdout.write('.'); // Progress dot
                skippedCount++;
                continue;
            }

            // Construct folder name: chapter-123 -> chuong-123
            let folderName = chapter.id;
            if (folderName.startsWith('chapter-')) {
                folderName = folderName.replace('chapter-', 'chuong-');
            } else if (!folderName.startsWith('chuong-')) {
                // If it's just a number or something else, force chuong- prefix
                 // Assuming format is suffix number
                 const match = folderName.match(/(\d+)$/);
                 if (match) {
                     folderName = `chuong-${match[1]}`;
                 } else {
                     folderName = `chuong-${folderName}`;
                 }
            }

            const folderPath = `/manga_verse/${MANGA_ID}/${folderName}`;

            // 3. Check ImageKit
            try {
                const files = await imagekit.listFiles({
                    path: folderPath,
                    limit: 100 // Assume max 100 images per chapter for now? Typically valid.
                });

                if (files && files.length > 0) {
                    // Sort files by name to ensure order (000.jpg, 001.jpg)
                    files.sort((a, b) => {
                        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                    });

                    const imageUrls = files.map(f => f.url);

                    // 4. Update Database
                    await ChapterDetail.findOneAndUpdate(
                        { manga_id: MANGA_ID, chapter_id: chapter.id },
                        {
                            images: imageUrls,
                            updated_at: new Date(),
                            $setOnInsert: { created_at: new Date() }
                        },
                        { upsert: true }
                    );

                    console.log(`\n✅ Restored Chapter ${chapter.id} (${files.length} images)`);
                    restoredCount++;
                } else {
                    // console.log(`\n⚠️ No images found for ${folderPath}`);
                    process.stdout.write('x'); // Mark missing
                }

            } catch (err) {
                console.error(`\n❌ Error checking ${folderPath}:`, err.message);
            }
        }

        console.log(`\n\n🎉 Sync Complete!`);
        console.log(`- Skipped (Already OK): ${skippedCount}`);
        console.log(`- Restored: ${restoredCount}`);

    } catch (error) {
        console.error("\n❌ Fatal Error:", error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

syncChapters();
