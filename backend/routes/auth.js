const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { protect } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, bio, subject } = req.body;

    const user = await User.create({ username, email, password, bio, subject });
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        subject: user.subject,
        isOnline: user.isOnline,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        subject: user.subject,
        isOnline: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', protect, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: new Date(),
    });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile
router.put('/profile', protect, async (req, res, next) => {
  try {
    const { username, bio, subject, avatar } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { username, bio, subject, avatar },
      { new: true, runValidators: true }
    );

    res.json({ user: updatedUser });
  } catch (error) {
    next(error);
  }
});

module.exports = router;