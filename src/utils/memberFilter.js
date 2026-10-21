import mongoose from 'mongoose';
import AppError from './AppError.js';
import { asString, containsRegex } from './query.js';

// Builds a MongoDB filter from ?q=&category=&area=&bloodGroup=
// Used by the member directory (app) and member management (admin).
const buildMemberFilter = (query) => {
  const filter = { role: 'user' };

  const q = asString(query.q);
  if (q) {
    const regex = containsRegex(q);
    filter.$or = [{ name: regex }, { 'business.name': regex }, { mobile: regex }];
  }

  const category = asString(query.category);
  if (category) {
    if (!mongoose.isValidObjectId(category)) throw new AppError('Invalid category', 400);
    filter['business.category'] = category;
  }

  const area = asString(query.area);
  if (area) {
    const regex = containsRegex(area);
    filter.$and = [{ $or: [{ area: regex }, { city: regex }, { address: regex }] }];
  }

  const bloodGroup = asString(query.bloodGroup);
  if (bloodGroup) filter.bloodGroup = bloodGroup.toUpperCase();

  return filter;
};

export default buildMemberFilter;
