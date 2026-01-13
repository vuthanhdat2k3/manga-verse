require('dotenv').config();
const ImageKit = require('imagekit');

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'placeholder',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'placeholder',
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'placeholder'
});

/**
 * Delete a folder from ImageKit
 * @param {string} folderPath 
 */
async function deleteFolder(folderPath) {
    if (!process.env.IMAGEKIT_PRIVATE_KEY) {
        console.log(`[Mock] Deleting ImageKit folder: ${folderPath}`);
        return;
    }
    
    try {
        console.log(`🗑️ Deleting ImageKit folder: ${folderPath}`);
        await new Promise((resolve, reject) => {
            imagekit.deleteFolder(folderPath, (error, result) => {
                if (error) {
                    // Start silent fail if folder doesn't exist to avoid crashing
                    if (error.message && error.message.includes('not found')) {
                        resolve();
                    } else {
                        console.error('ImageKit deleteFolder error:', error);
                        // resolve anyway to not block DB deletion? 
                        // Better to log and continue
                        resolve(); 
                    }
                } else {
                    resolve(result);
                }
            });
        });
    } catch (e) {
        console.error('ImageKit wrapper error:', e);
    }
}

/**
 * Delete a single file by fileId (not URL) - Helper if needed
 * Note: We mostly delete folders in this app structure.
 */
async function deleteFile(fileId) {
    // Implementation if needed
}

module.exports = {
    deleteFolder,
    imagekit
};
