const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      default: '',
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    isPinned: {
      type: Boolean,
      default: false,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: '#ffffff',
    },
    // One-to-many: User → Notes
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Optional: notes can belong to a study room
    studyRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyRoom',
      default: null,
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Text index for search
noteSchema.index({ title: 'text', content: 'text', subject: 'text' });

module.exports = mongoose.model('Note', noteSchema);