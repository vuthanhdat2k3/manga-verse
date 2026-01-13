const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  baseUrl: { type: String, required: true, default: 'https://halcyonhomecare.co.uk' },
  mangaDetailUrlPattern: { type: String, default: 'https://halcyonhomecare.co.uk/truyen-tranh/{slug}' },
  chapterUrlPattern: { type: String, default: 'https://halcyonhomecare.co.uk/truyen-tranh/{slug}/{chapter}' }, // Separator might be needed
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Config', configSchema);
