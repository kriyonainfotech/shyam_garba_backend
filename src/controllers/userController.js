import User from '../models/User.js';

// GET /api/users (admin only)
export const getUsers = async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: users.length,
    users,
  });
};
