const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// GET /api/users - Search users
router.get('/', protect, async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = { _id: { $ne: req.user._id } };

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('username avatar isOnline lastSeen bio subject')
      .limit(20);

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/online - Get all online users
router.get('/online', protect, async (req, res, next) => {
  try {
    const users = await User.find({ isOnline: true })
      .select('username avatar isOnline lastSeen');
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username avatar isOnline lastSeen bio subject createdAt');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;