const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  baseUrl: { type: String, required: true, default: 'https://nettruyen.one' },
  mangaDetailUrlPattern: { type: String, default: 'https://nettruyen.one/truyen-tranh/{slug}' },
  chapterUrlPattern: { type: String, default: 'https://nettruyen.one/truyen-tranh/{slug}/chapter-{chapter}' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Config', configSchema);
