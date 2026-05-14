const mongoose = require('mongoose');

const fileAttachmentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    originalName: {
      type: String,
      required: [true, 'Original file name is required'],
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
    },
    fileKey: {
      type: String,
      required: [true, 'File key is required'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
    },
    size: {
      type: Number,
      required: [true, 'File size is required'],
    },
    fileType: {
      type: String,
      enum: ['avatar', 'note-attachment', 'room-cover', 'message-file'],
      required: [true, 'File type is required'],
    },
    // Owner of the file
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Optional references
    studyRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyRoom',
      default: null,
    },
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note',
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FileAttachment', fileAttachmentSchema);