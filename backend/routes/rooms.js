const express = require('express');
const router = express.Router();
const StudyRoom = require('../models/StudyRoom');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');

// GET /api/rooms - Get all public rooms (with search/filter)
router.get('/', protect, async (req, res, next) => {
  try {
    const { search, subject, page = 1, limit = 12 } = req.query;
    const query = { isPrivate: false };

    if (subject) query.subject = subject;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const rooms = await StudyRoom.find(query)
      .populate('owner', 'username avatar')
      .populate('members', 'username avatar isOnline')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await StudyRoom.countDocuments(query);

    res.json({ rooms, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms/my - Get rooms the user is a member of or owns
router.get('/my', protect, async (req, res, next) => {
  try {
    const rooms = await StudyRoom.find({
      $or: [{ owner: req.user._id }, { members: req.user._id }],
    })
      .populate('owner', 'username avatar')
      .populate('members', 'username avatar isOnline')
      .sort({ updatedAt: -1 });

    res.json({ rooms });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const room = await StudyRoom.findById(req.params.id)
      .populate('owner', 'username avatar email')
      .populate('members', 'username avatar isOnline lastSeen');

    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isMember =
      room.owner._id.toString() === req.user._id.toString() ||
      room.members.some((m) => m._id.toString() === req.user._id.toString());

    if (room.isPrivate && !isMember) {
      return res.status(403).json({ message: 'This room is private' });
    }

    res.json({ room });
  } catch (error) {
    next(error);
  }
});

// POST /api/rooms - Create room
router.post('/', protect, async (req, res, next) => {
  try {
    const { name, description, subject, isPrivate, tags, maxMembers, coverImage } = req.body;

    const room = await StudyRoom.create({
      name,
      description,
      subject,
      isPrivate,
      tags,
      maxMembers,
      coverImage,
      owner: req.user._id,
      members: [req.user._id],
    });

    await room.populate('owner', 'username avatar');
    res.status(201).json({ room });
  } catch (error) {
    next(error);
  }
});

// PUT /api/rooms/:id - Update room
router.put('/:id', protect, async (req, res, next) => {
  try {
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (room.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can update this room' });
    }

    const { name, description, subject, isPrivate, tags, maxMembers, coverImage } = req.body;
    const updated = await StudyRoom.findByIdAndUpdate(
      req.params.id,
      { name, description, subject, isPrivate, tags, maxMembers, coverImage },
      { new: true, runValidators: true }
    )
      .populate('owner', 'username avatar')
      .populate('members', 'username avatar isOnline');

    res.json({ room: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/rooms/:id
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (room.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete this room' });
    }

    await Message.deleteMany({ studyRoom: req.params.id });
    await StudyRoom.findByIdAndDelete(req.params.id);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/rooms/:id/join
router.post('/:id/join', protect, async (req, res, next) => {
  try {
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (room.members.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already a member' });
    }

    if (room.members.length >= room.maxMembers) {
      return res.status(400).json({ message: 'Room is full' });
    }

    room.members.push(req.user._id);
    await room.save();

    await room.populate('owner', 'username avatar');
    await room.populate('members', 'username avatar isOnline');

    res.json({ room });
  } catch (error) {
    next(error);
  }
});

// POST /api/rooms/:id/leave
router.post('/:id/leave', protect, async (req, res, next) => {
  try {
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (room.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Owner cannot leave. Delete the room instead.' });
    }

    room.members = room.members.filter((m) => m.toString() !== req.user._id.toString());
    await room.save();

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms/:id/messages
router.get('/:id/messages', protect, async (req, res, next) => {
  try {
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isMember =
      room.owner.toString() === req.user._id.toString() ||
      room.members.includes(req.user._id);

    if (!isMember) return res.status(403).json({ message: 'Not a member of this room' });

    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find({
      studyRoom: req.params.id,
      isDeleted: false,
    })
      .populate('sender', 'username avatar')
      .populate('replyTo')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ messages: messages.reverse() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;