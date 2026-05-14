const mongoose = require('mongoose');

const studyRoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      minlength: [3, 'Room name must be at least 3 characters'],
      maxlength: [60, 'Room name cannot exceed 60 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      enum: [
        'Mathematics',
        'Physics',
        'Chemistry',
        'Biology',
        'Computer Science',
        'History',
        'Literature',
        'Language',
        'Economics',
        'Other',
      ],
    },
    coverImage: {
      type: String,
      default: null,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    // One-to-many: User → StudyRooms (owner)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Many-to-many: Users ↔ StudyRooms
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    maxMembers: {
      type: Number,
      default: 50,
      min: 2,
      max: 200,
    },
  },
  { timestamps: true }
);

// Index for search
studyRoomSchema.index({ name: 'text', description: 'text', subject: 'text' });

module.exports = mongoose.model('StudyRoom', studyRoomSchema);