import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';
import { asString } from '../utils/query.js';

// POST /api/scan/access
// Body: { code }  - the secret code the admin shared for one event.
// After this, the member can scan passes for that event.
export const getScanAccess = async (req, res) => {
  const code = asString(req.body?.code);
  if (!code) {
    throw new AppError('code is required', 400);
  }

  const event = await Event.findOneAndUpdate(
    { scanCode: code.toUpperCase(), status: { $ne: 'cancelled' } },
    { $addToSet: { scanners: req.user._id } },
    { new: true }
  );
  if (!event) {
    throw new AppError('Invalid scan code', 404);
  }

  await logActivity(req.user._id, 'scan.access', `Got scanning access for "${event.title}"`, {
    event: event._id,
  });
  res.status(200).json({ success: true, event: { _id: event._id, title: event.title, startAt: event.startAt } });
};

// GET /api/scan/events  - events this member is allowed to scan for
export const getMyScanEvents = async (req, res) => {
  const events = await Event.find({ scanners: req.user._id, status: { $ne: 'cancelled' } })
    .select('title startAt endAt venue')
    .sort({ startAt: -1 });

  res.status(200).json({ success: true, count: events.length, events });
};

// POST /api/scan/verify
// Body: { eventId, passCode }  - passCode is read from the member's QR code.
// Marks the pass as used, so the same pass cannot enter twice.
export const verifyPass = async (req, res) => {
  const eventId = asString(req.body?.eventId);
  const passCode = asString(req.body?.passCode);
  if (!eventId || !passCode) {
    throw new AppError('eventId and passCode are required', 400);
  }
  if (!mongoose.isValidObjectId(eventId)) {
    throw new AppError('Invalid eventId', 400);
  }

  const canScan =
    req.user.role === 'admin' ||
    (await Event.exists({ _id: eventId, scanners: req.user._id }));
  if (!canScan) {
    throw new AppError('You do not have scanning access for this event', 403);
  }

  const booking = await Booking.findOne({ passCode }).populate('user', 'name photo mobile');
  if (!booking) {
    throw new AppError('Invalid pass', 404);
  }

  const passInfo = {
    bookingId: booking._id,
    member: booking.user,
    seats: booking.seats,
  };

  if (!booking.event.equals(eventId)) {
    return res.status(400).json({ success: false, message: 'This pass is for a different event', pass: passInfo });
  }
  if (booking.status !== 'confirmed') {
    return res.status(400).json({ success: false, message: 'This booking is not paid/confirmed', pass: passInfo });
  }

  // Only succeeds if nobody checked this pass in before (also safe if two
  // volunteers scan the same pass at the same second)
  const checkedIn = await Booking.findOneAndUpdate(
    { _id: booking._id, checkedInAt: null },
    { checkedInAt: new Date(), checkedInBy: req.user._id },
    { new: true }
  );

  if (!checkedIn) {
    const earlier = await Booking.findById(booking._id).populate('checkedInBy', 'name');
    return res.status(409).json({
      success: false,
      message: 'This pass was already used',
      pass: { ...passInfo, checkedInAt: earlier.checkedInAt, checkedInBy: earlier.checkedInBy?.name },
    });
  }

  await logActivity(req.user._id, 'scan.checkin', `Checked in ${booking.user?.name || 'a member'}`, {
    booking: booking._id,
    event: booking.event,
  });

  res.status(200).json({
    success: true,
    message: 'Entry allowed',
    pass: { ...passInfo, checkedInAt: checkedIn.checkedInAt },
  });
};
