import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';
import { deleteUploadedFile } from '../utils/files.js';
import { applyProfileUpdates } from '../utils/profile.js';
import { toPublicUser } from './authController.js';

// GET /api/profile
export const getProfile = async (req, res) => {
  await req.user.populate('business.category', 'name');
  res.status(200).json({ success: true, user: toPublicUser(req.user) });
};

// PUT /api/profile
export const updateProfile = async (req, res) => {
  const user = req.user;

  await applyProfileUpdates(user, req.body ?? {});
  await user.save();
  await user.populate('business.category', 'name');
  await logActivity(user._id, 'profile.update', `${user.name} updated their profile`);

  res.status(200).json({ success: true, user: toPublicUser(user) });
};

// POST /api/profile/photo  (multipart/form-data, field "photo")
// Bad file type / too large is rejected by the upload middleware (400).
export const uploadPhoto = async (req, res) => {
  const newPhoto = req.file.publicPath;
  const oldPhoto = req.user.photo;

  try {
    // Only the photo field is updated, so other profile fields can't block it
    await User.updateOne({ _id: req.user._id }, { photo: newPhoto });
  } catch (error) {
    console.error('Saving profile photo failed:', error.message);
    await deleteUploadedFile(newPhoto); // don't leave an unused file on disk
    throw new AppError('Could not save your photo, please try again', 500);
  }

  // Old photo is removed only after the new one is saved
  await deleteUploadedFile(oldPhoto);

  res.status(200).json({ success: true, photo: newPhoto });
};
