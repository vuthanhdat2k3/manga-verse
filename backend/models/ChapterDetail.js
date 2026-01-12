const mongoose = require('mongoose');

const chapterDetailSchema = new mongoose.Schema({
  manga_id: { type: String, required: true },
  chapter_id: { type: String, required: true },
  images: [String], // Array of ImageKit URLs
  updated_at: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
}, {
  bufferCommands: false,  // Disable buffering for production reliability
  bufferTimeoutMS: 30000
});

// Compound index for faster lookups
chapterDetailSchema.index({ manga_id: 1, chapter_id: 1 }, { unique: true });

module.exports = mongoose.model('ChapterDetail', chapterDetailSchema);
