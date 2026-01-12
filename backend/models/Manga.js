const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  id: String, // slug e.g. "chapter-1"
  title: String,
  url: String, // Original URL
  updated_at: { type: Date, default: Date.now }
});

const mangaSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // slug e.g. "one-piece"
  title: { type: String, required: true },
  thumbnail: String,
  description: String,
  author: String,
  status: String,
  genres: [String],
  chapters: [chapterSchema], 
  updated_at: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
});

// Text index for search
mangaSchema.index({ title: 'text' });

module.exports = mongoose.model('Manga', mangaSchema);
