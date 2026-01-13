const express = require('express');
const router = express.Router();
const Manga = require('../models/Manga');
const ChapterDetail = require('../models/ChapterDetail');
const { deleteFolder } = require('../services/imageService');

// DELETE /api/admin/mangas/:id
// Delete a manga, its chapters, and cloud images
router.delete('/mangas/:id', async (req, res) => {
    try {
        const mangaId = req.params.id;
        console.log(`🗑️ Admin deleting manga: ${mangaId}`);

        // 1. Delete images from ImageKit
        // Folder structure: /manga_verse/<mangaId>
        await deleteFolder(`/manga_verse/${mangaId}`);
        
        // Also try to delete cover if it exists in separate folder?
        // Covers are at /manga_verse/covers/<id>.jpg
        // Managing individual files via ID is hard without storing fileId.
        // If we only store URL, we can't easily delete single files via API without searching.
        // For now, we accept covers might linger or we need to find them.
        // We will skip cover deletion for now to avoid complexity, or try to delete the folder if covers were per-manga (they are not).

        // 2. Delete ChapterDetails
        await ChapterDetail.deleteMany({ manga_id: mangaId });

        // 3. Delete Manga
        const result = await Manga.findOneAndDelete({ id: mangaId });

        if (!result) {
            return res.status(404).json({ error: 'Manga not found' });
        }

        res.json({ success: true, message: `Deleted manga ${mangaId} and its data` });
    } catch (error) {
        console.error('Delete manga error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/mangas/:mangaId/chapters
// Body: { chapterIds: ['chapter-1', 'chapter-2'] }
router.delete('/mangas/:mangaId/chapters', async (req, res) => {
    try {
        const { mangaId } = req.params;
        const { chapterIds } = req.body;

        if (!chapterIds || !Array.isArray(chapterIds)) {
            return res.status(400).json({ error: 'chapterIds array required' });
        }

        console.log(`🗑️ Admin deleting ${chapterIds.length} chapters from ${mangaId}`);

        // 1. Delete images from ImageKit for each chapter
        // Folder: /manga_verse/<mangaId>/<chapterId> (converted to chuong-*)
        for (const chapId of chapterIds) {
            let folderName = chapId;
            if (folderName.startsWith('chapter-')) {
                folderName = folderName.replace('chapter-', 'chuong-');
            } else if (!folderName.startsWith('chuong-')) {
                folderName = `chuong-${folderName}`;
            }
            await deleteFolder(`/manga_verse/${mangaId}/${folderName}`);
        }

        // 2. Delete ChapterDetail docs
        await ChapterDetail.deleteMany({ 
            manga_id: mangaId, 
            chapter_id: { $in: chapterIds } 
        });

        // 3. Update Manga document logic removed. 
        // We keep the chapter in the list so it can be re-downloaded.
        // await Manga.findOneAndUpdate(...) 


        res.json({ success: true, message: `Deleted ${chapterIds.length} chapters` });
    } catch (error) {
        console.error('Delete chapters error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
