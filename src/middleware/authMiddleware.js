import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

// AUTHENTICATION: "Who are you?"
// Reads the token from the "Authorization: Bearer <token>" header,
// verifies it, and attaches the logged-in user to req.user.
export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Not authorized, please log in', 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET); // throws if invalid or expired

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new AppError('User for this token no longer exists', 401);
  }

  // Checked on every request, so blocking works immediately
  if (user.status === 'blocked') {
    throw new AppError('Your account has been blocked. Please contact the admin.', 403);
  }

  req.user = user;
  next();
};

// Use after protect. New members can log in and fill their profile,
// but everything else waits until the Super Admin approves them.
export const approvedOnly = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.status !== 'approved') {
    throw new AppError('Your account is waiting for admin approval', 403);
  }
  next();
};

// AUTHORIZATION: "Are you allowed to do this?"
// Use after protect, e.g. authorize('admin')
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    throw new AppError('You do not have permission to do this', 403);
  }
  next();
};
