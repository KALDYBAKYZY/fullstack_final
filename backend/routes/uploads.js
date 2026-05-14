const express = require('express');
const router = express.Router();
const FileAttachment = require('../models/FileAttachment');
const User = require('../models/User');
const StudyRoom = require('../models/StudyRoom');
const { protect } = require('../middleware/auth');


const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const validateFile = ({ fileUrl, fileKey, mimeType, size }, res) => {
  if (!fileUrl || !fileKey) {
    res.status(400).json({
      message: 'fileUrl and fileKey are required',
    });
    return false;
  }

  if (!allowedTypes.includes(mimeType)) {
    res.status(400).json({
      message: 'Invalid file type',
    });
    return false;
  }

  if (size > MAX_FILE_SIZE) {
    res.status(400).json({
      message: 'File size exceeds 10MB limit',
    });
    return false;
  }

  return true;
};


router.post('/avatar', protect, async (req, res, next) => {
  try {
    const { fileUrl, fileKey, fileName, size, mimeType } = req.body;

    const isValid = validateFile(
      { fileUrl, fileKey, mimeType, size },
      res
    );

    if (!isValid) return;

    const fileAttachment = await FileAttachment.create({
      fileName: fileName || 'avatar',
      originalName: fileName || 'avatar',
      fileUrl,
      fileKey,
      mimeType,
      size,
      fileType: 'avatar',
      uploadedBy: req.user._id,
      isPublic: true,
    });

    await User.findByIdAndUpdate(req.user._id, {
      avatar: fileUrl,
    });

    res.status(201).json({
      fileAttachment,
      avatarUrl: fileUrl,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/attachment', protect, async (req, res, next) => {
  try {
    const {
      fileUrl,
      fileKey,
      fileName,
      size,
      mimeType,
      noteId,
      roomId,
    } = req.body;

    const isValid = validateFile(
      { fileUrl, fileKey, mimeType, size },
      res
    );

    if (!isValid) return;

    const fileAttachment = await FileAttachment.create({
      fileName: fileName || 'attachment',
      originalName: fileName || 'attachment',
      fileUrl,
      fileKey,
      mimeType,
      size,
      fileType: noteId
        ? 'note-attachment'
        : roomId
        ? 'room-cover'
        : 'message-file',
      uploadedBy: req.user._id,
      note: noteId || null,
      studyRoom: roomId || null,
      isPublic: false,
    });

    res.status(201).json({
      fileAttachment,
    });
  } catch (error) {
    next(error);
  }
});


router.post('/room-cover', protect, async (req, res, next) => {
  try {
    const {
      fileUrl,
      fileKey,
      fileName,
      size,
      mimeType,
      roomId,
    } = req.body;

    const isValid = validateFile(
      { fileUrl, fileKey, mimeType, size },
      res
    );

    if (!isValid) return;

    const room = await StudyRoom.findById(roomId);

    if (!room) {
      return res.status(404).json({
        message: 'Room not found',
      });
    }

    if (room.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You can only upload cover for your own room',
      });
    }

    const fileAttachment = await FileAttachment.create({
      fileName: fileName || 'room-cover',
      originalName: fileName || 'room-cover',
      fileUrl,
      fileKey,
      mimeType,
      size,
      fileType: 'room-cover',
      uploadedBy: req.user._id,
      studyRoom: roomId,
      isPublic: true,
    });

    res.status(201).json({
      fileAttachment,
      coverUrl: fileUrl,
    });
  } catch (error) {
    next(error);
  }
});


router.get('/my', protect, async (req, res, next) => {
  try {
    const files = await FileAttachment.find({
      uploadedBy: req.user._id,
    }).sort({ createdAt: -1 });

    res.json({ files });
  } catch (error) {
    next(error);
  }
});

router.get('/room/:roomId', protect, async (req, res, next) => {
  try {
    const files = await FileAttachment.find({
      studyRoom: req.params.roomId,
      fileType: 'note-attachment',
    })
      .populate('uploadedBy', 'username avatar')
      .sort({ createdAt: -1 });

    res.json({ files });
  } catch (error) {
    next(error);
  }
});



router.delete('/:id', protect, async (req, res, next) => {
  try {
    const file = await FileAttachment.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        message: 'File not found',
      });
    }

    if (file.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You can only delete your own files',
      });
    }

    await FileAttachment.findByIdAndDelete(req.params.id);

    res.json({
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

