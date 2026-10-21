import mongoose from 'mongoose';
import BusinessEntry from '../models/BusinessEntry.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';
import { getPagination, pageMeta } from '../utils/pagination.js';
import { asString } from '../utils/query.js';

const MEMBER_SUMMARY = 'name photo mobile business.name';

// POST /api/business
// Body: { memberId, type: "given" | "received", amount, date, note }
// "given"    -> I gave business to memberId
// "received" -> I received business from memberId
export const createEntry = async (req, res) => {
  const { memberId, type, amount, date, note } = req.body ?? {};

  if (type !== 'given' && type !== 'received') {
    throw new AppError('type must be "given" or "received"', 400);
  }
  if (!mongoose.isValidObjectId(memberId)) {
    throw new AppError('Please select a member', 400);
  }
  if (req.user._id.equals(memberId)) {
    throw new AppError('You cannot record business with yourself', 400);
  }

  const member = await User.findOne({ _id: memberId, role: 'user', status: 'approved' });
  if (!member) {
    throw new AppError('Member not found', 404);
  }

  const entry = await BusinessEntry.create({
    fromUser: type === 'given' ? req.user._id : member._id,
    toUser: type === 'given' ? member._id : req.user._id,
    amount,
    date,
    note,
    recordedBy: req.user._id,
  });

  await logActivity(
    req.user._id,
    'business.create',
    `Recorded ₹${entry.amount} business ${type === 'given' ? 'given to' : 'received from'} ${member.name}`,
    { entry: entry._id }
  );

  await entry.populate([
    { path: 'fromUser', select: MEMBER_SUMMARY },
    { path: 'toUser', select: MEMBER_SUMMARY },
  ]);
  res.status(201).json({ success: true, entry });
};

// GET /api/business?type=given|received&page=&limit=
export const getMyEntries = async (req, res) => {
  const type = asString(req.query.type);
  const me = req.user._id;

  let filter;
  if (type === 'given') filter = { fromUser: me };
  else if (type === 'received') filter = { toUser: me };
  else filter = { $or: [{ fromUser: me }, { toUser: me }] };

  const pagination = getPagination(req.query);
  const [entries, total] = await Promise.all([
    BusinessEntry.find(filter)
      .populate('fromUser', MEMBER_SUMMARY)
      .populate('toUser', MEMBER_SUMMARY)
      .sort({ date: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    BusinessEntry.countDocuments(filter),
  ]);

  // Tell the app which side the logged-in member is on
  const withType = entries.map((e) => ({
    ...e.toJSON(),
    type: e.fromUser?._id?.equals(me) ? 'given' : 'received',
  }));

  res.status(200).json({ success: true, count: entries.length, ...pageMeta(total, pagination), entries: withType });
};

// GET /api/business/summary  - my total given vs received
export const getMySummary = async (req, res) => {
  const me = req.user._id;

  const [given, received] = await Promise.all([
    BusinessEntry.aggregate([
      { $match: { fromUser: me } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    BusinessEntry.aggregate([
      { $match: { toUser: me } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    summary: {
      given: { total: given[0]?.total || 0, count: given[0]?.count || 0 },
      received: { total: received[0]?.total || 0, count: received[0]?.count || 0 },
    },
  });
};

// DELETE /api/business/:id  - only the member who recorded it (or admin)
export const deleteEntry = async (req, res) => {
  const entry = await BusinessEntry.findById(req.params.id);
  if (!entry || (!entry.recordedBy.equals(req.user._id) && req.user.role !== 'admin')) {
    throw new AppError('Entry not found', 404);
  }

  await entry.deleteOne();
  await logActivity(req.user._id, 'business.delete', `Deleted a ₹${entry.amount} business entry`);
  res.status(200).json({ success: true, message: 'Entry deleted' });
};
