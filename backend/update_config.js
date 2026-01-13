const mongoose = require('mongoose');
const Config = require('./models/Config');
require('dotenv').config();

async function updateConfig() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ DB Connected");

        // Correct pattern with explicit chapter- prefix
        const newPattern = "https://halcyonhomecare.co.uk/truyen-tranh/{slug}/chapter-{chapter}";
        
        const result = await Config.findOneAndUpdate(
            { key: 'default' },
            { 
                $set: { 
                    chapterUrlPattern: newPattern,
                    updatedAt: new Date()
                } 
            },
            { new: true, upsert: true }
        );

        console.log("✅ Config updated:", result);
    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

updateConfig();
