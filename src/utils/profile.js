import mongoose from 'mongoose';
import Category from '../models/Category.js';
import AppError from './AppError.js';
import { isPlainObject } from './query.js';

const TEXT_FIELDS = ['name', 'mobile', 'address', 'area', 'city', 'bloodGroup'];
const OBJECT_FIELDS = ['location', 'emergencyContact', 'business'];

// Copies only the allowed profile fields from `body` onto the user.
// role, status, email etc. can never be changed this way.
// Send `null` to clear a field.
export const applyProfileUpdates = async (user, body = {}) => {
  TEXT_FIELDS.forEach((field) => {
    if (body[field] !== undefined) user.set(field, body[field] || undefined);
  });

  for (const field of OBJECT_FIELDS) {
    const value = body[field];
    if (value === undefined) continue;
    if (value !== null && !isPlainObject(value)) {
      throw new AppError(`${field} must be an object`, 400);
    }
    user.set(field, value || undefined);
  }

  const categoryId = body.business?.category;
  if (categoryId) {
    if (!mongoose.isValidObjectId(categoryId)) {
      throw new AppError('Invalid business category', 400);
    }
    const category = await Category.findOne({ _id: categoryId, isActive: true });
    if (!category) {
      throw new AppError('Business category not found', 400);
    }
  }
};
