const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const { protect } = require('../middleware/auth');

// GET /api/notes - Get user's notes (with search/filter)
router.get('/', protect, async (req, res, next) => {
  try {
    const { search, subject, roomId, page = 1, limit = 20 } = req.query;
    const query = { author: req.user._id };

    if (subject) query.subject = subject;
    if (roomId) query.studyRoom = roomId;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const notes = await Note.find(query)
      .populate('author', 'username avatar')
      .populate('studyRoom', 'name subject')
      .sort({ isPinned: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Note.countDocuments(query);

    res.json({ notes, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

// GET /api/notes/public - Get public notes
router.get('/public', protect, async (req, res, next) => {
  try {
    const { search, subject } = req.query;
    const query = { isPublic: true };

    if (subject) query.subject = subject;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const notes = await Note.find(query)
      .populate('author', 'username avatar')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json({ notes });
  } catch (error) {
    next(error);
  }
});

// GET /api/notes/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('author', 'username avatar')
      .populate('studyRoom', 'name subject');

    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (!note.isPublic && note.author._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ note });
  } catch (error) {
    next(error);
  }
});

// POST /api/notes
router.post('/', protect, async (req, res, next) => {
  try {
    const { title, content, subject, tags, isPinned, isPublic, color, studyRoom } = req.body;

    const note = await Note.create({
      title,
      content,
      subject,
      tags,
      isPinned,
      isPublic,
      color,
      studyRoom: studyRoom || null,
      author: req.user._id,
      lastEditedBy: req.user._id,
    });

    await note.populate('author', 'username avatar');
    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notes/:id
router.put('/:id', protect, async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (note.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own notes' });
    }

    const { title, content, subject, tags, isPinned, isPublic, color } = req.body;

    const updated = await Note.findByIdAndUpdate(
      req.params.id,
      { title, content, subject, tags, isPinned, isPublic, color, lastEditedBy: req.user._id },
      { new: true, runValidators: true }
    )
      .populate('author', 'username avatar')
      .populate('studyRoom', 'name subject');

    res.json({ note: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notes/:id
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (note.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own notes' });
    }

    await Note.findByIdAndDelete(req.params.id);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;