import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';
import Venue from '../models/Venue.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';
import { generateScanCode } from '../utils/codes.js';
import sendExcel from '../utils/excel.js';
import { deleteUploadedFile } from '../utils/files.js';
import { getPagination, pageMeta } from '../utils/pagination.js';
import sendPush from '../utils/push.js';
import { asString } from '../utils/query.js';

const EVENT_FIELDS = [
  'title',
  'description',
  'startAt',
  'endAt',
  'bookingDeadline',
  'venue',
  'price',
  'seatLimit',
  'maxSeatsPerBooking',
  'formFields',
  'status',
];

// Copies only allowed fields. If venueId is sent, the venue details are
// filled in from the saved Garba class venue.
const pickEventFields = async (body = {}) => {
  const data = Object.fromEntries(
    EVENT_FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]])
  );

  if (body.venueId) {
    if (!mongoose.isValidObjectId(body.venueId)) throw new AppError('Invalid venueId', 400);
    const venue = await Venue.findById(body.venueId);
    if (!venue) throw new AppError('Venue not found', 400);
    data.venue = { name: venue.name, address: venue.address, location: venue.location };
  }
  return data;
};

const createUniqueScanCode = async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateScanCode();
    if (!(await Event.exists({ scanCode: code }))) return code;
  }
  throw new AppError('Could not generate a scan code, please try again', 500);
};

// Adds the event to everyone's notification list and sends a push
const announceEvent = async (event, adminId) => {
  const notification = await Notification.create({
    title: `New event: ${event.title}`,
    body: `${event.venue.name} | ${event.startAt.toDateString()} | Book your seat now!`,
    type: 'event',
    event: event._id,
    sentBy: adminId,
  });
  const { sent } = await sendPush(
    { role: 'user', status: 'approved' },
    {
      title: notification.title,
      body: notification.body,
      data: { type: 'event', eventId: event._id },
    }
  );
  notification.devicesReached = sent;
  await notification.save();
};

const findEventOr404 = async (id, select = '') => {
  const event = await Event.findById(id).select(select);
  if (!event) throw new AppError('Event not found', 404);
  return event;
};

// GET /api/events?when=upcoming|past|all&status=&page=&limit=
// Members only see published events. Admin sees all and can filter by status.
export const getEvents = async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const filter = {};

  if (isAdmin) {
    const status = asString(req.query.status);
    if (status) filter.status = status;
  } else {
    filter.status = 'published';
  }

  const when = asString(req.query.when) || (isAdmin ? 'all' : 'upcoming');
  const now = new Date();
  if (when === 'upcoming') {
    filter.$or = [{ endAt: { $gte: now } }, { endAt: null, startAt: { $gte: now } }];
  } else if (when === 'past') {
    filter.$or = [{ endAt: { $lt: now } }, { endAt: null, startAt: { $lt: now } }];
  }

  const pagination = getPagination(req.query);
  const [events, total] = await Promise.all([
    Event.find(filter)
      .sort({ startAt: when === 'past' ? -1 : 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Event.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: events.length, ...pageMeta(total, pagination), events });
};

// GET /api/events/:id  (admin also gets the scan code)
export const getEvent = async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const event = await findEventOr404(req.params.id, isAdmin ? '+scanCode' : '');

  if (!isAdmin && event.status !== 'published') {
    throw new AppError('Event not found', 404);
  }

  res.status(200).json({ success: true, event });
};

// POST /api/events (admin)
export const createEvent = async (req, res) => {
  const data = await pickEventFields(req.body);
  const event = await Event.create({
    ...data,
    seatsBooked: 0,
    scanCode: await createUniqueScanCode(),
    createdBy: req.user._id,
  });

  await logActivity(req.user._id, 'admin.event_create', `Created event "${event.title}"`, {
    event: event._id,
  });

  if (event.status === 'published') {
    announceEvent(event, req.user._id).catch((err) => console.error('Announce failed:', err.message));
  }

  res.status(201).json({ success: true, event });
};

// PUT /api/events/:id (admin)
export const updateEvent = async (req, res) => {
  const event = await findEventOr404(req.params.id, '+scanCode');
  const wasPublished = event.status === 'published';

  event.set(await pickEventFields(req.body));
  await event.save();

  await logActivity(req.user._id, 'admin.event_update', `Updated event "${event.title}"`, {
    event: event._id,
  });

  if (!wasPublished && event.status === 'published') {
    announceEvent(event, req.user._id).catch((err) => console.error('Announce failed:', err.message));
  }

  res.status(200).json({ success: true, event });
};

// DELETE /api/events/:id (admin)
// If the event has bookings, ?force=true is needed; its bookings are deleted too.
export const deleteEvent = async (req, res) => {
  const event = await findEventOr404(req.params.id);

  const activeBookings = await Booking.countDocuments({
    event: event._id,
    status: { $in: ['pending', 'confirmed'] },
  });
  if (activeBookings > 0 && req.query.force !== 'true') {
    throw new AppError(
      `This event has ${activeBookings} booking(s). Set its status to "cancelled", or delete it with all bookings.`,
      409
    );
  }

  await Booking.deleteMany({ event: event._id });
  await event.deleteOne();
  await deleteUploadedFile(event.bannerImage);

  await logActivity(
    req.user._id,
    'admin.event_delete',
    `Deleted event "${event.title}"${activeBookings ? ` with ${activeBookings} booking(s)` : ''}`
  );
  res.status(200).json({ success: true, message: 'Event deleted' });
};

// POST /api/events/:id/banner (admin, multipart field "banner")
export const uploadBanner = async (req, res) => {
  const newBanner = req.file.publicPath;

  if (!mongoose.isValidObjectId(req.params.id)) {
    await deleteUploadedFile(newBanner);
    throw new AppError('Invalid event id', 400);
  }

  let event;
  try {
    // Returns the event as it was before, so we know the old banner
    event = await Event.findByIdAndUpdate(req.params.id, { bannerImage: newBanner });
  } catch (error) {
    console.error('Saving event banner failed:', error.message);
    await deleteUploadedFile(newBanner); // don't leave an unused file on disk
    throw new AppError('Could not save the banner, please try again', 500);
  }

  if (!event) {
    await deleteUploadedFile(newBanner);
    throw new AppError('Event not found', 404);
  }

  await deleteUploadedFile(event.bannerImage);
  res.status(200).json({ success: true, bannerImage: newBanner });
};

// POST /api/events/:id/scan-code (admin)
// Makes a new secret code. Old code stops working and scanner access is reset.
export const regenerateScanCode = async (req, res) => {
  const event = await findEventOr404(req.params.id);

  event.scanCode = await createUniqueScanCode();
  event.scanners = [];
  await event.save();

  await logActivity(req.user._id, 'admin.scan_code_reset', `Reset scan code for "${event.title}"`, {
    event: event._id,
  });
  res.status(200).json({ success: true, scanCode: event.scanCode });
};

// GET /api/events/:id/stats (admin) - live tracking for one event
export const getEventStats = async (req, res) => {
  const event = await findEventOr404(req.params.id, '+scanners');

  const groups = await Booking.aggregate([
    { $match: { event: new mongoose.Types.ObjectId(event._id) } },
    {
      $group: {
        _id: '$status',
        bookings: { $sum: 1 },
        seats: { $sum: '$seats' },
        amount: { $sum: '$amount' },
        checkedInBookings: { $sum: { $cond: [{ $ifNull: ['$checkedInAt', false] }, 1, 0] } },
        checkedInSeats: { $sum: { $cond: [{ $ifNull: ['$checkedInAt', false] }, '$seats', 0] } },
      },
    },
  ]);

  const byStatus = Object.fromEntries(groups.map((g) => [g._id, g]));
  const confirmed = byStatus.confirmed || {};

  res.status(200).json({
    success: true,
    stats: {
      seatLimit: event.seatLimit,
      seatsBooked: event.seatsBooked,
      seatsLeft: event.seatsLeft,
      confirmedBookings: confirmed.bookings || 0,
      confirmedSeats: confirmed.seats || 0,
      pendingBookings: byStatus.pending?.bookings || 0,
      paymentCollected: confirmed.amount || 0,
      checkedInBookings: confirmed.checkedInBookings || 0,
      checkedInSeats: confirmed.checkedInSeats || 0,
      refundsNeeded: byStatus.failed?.bookings || 0,
      scanners: event.scanners.length,
    },
  });
};

// GET /api/events/:id/bookings?status=&page=&limit= (admin)
export const getEventBookings = async (req, res) => {
  const event = await findEventOr404(req.params.id);
  const filter = { event: event._id };
  const status = asString(req.query.status);
  if (status) filter.status = status;

  const pagination = getPagination(req.query, 50);
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('user', 'name mobile email photo')
      .populate('checkedInBy', 'name')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: bookings.length, ...pageMeta(total, pagination), bookings });
};

// GET /api/events/:id/bookings/export (admin) - Excel file
export const exportEventBookings = async (req, res) => {
  const event = await findEventOr404(req.params.id);
  const bookings = await Booking.find({ event: event._id, status: { $in: ['confirmed', 'failed'] } })
    .populate('user', 'name mobile email')
    .sort({ createdAt: 1 });

  const columns = [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Mobile', key: 'mobile', width: 15 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Seats', key: 'seats', width: 8 },
    { header: 'Amount', key: 'amount', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Payment ID', key: 'paymentId', width: 22 },
    { header: 'Paid At', key: 'paidAt', width: 20 },
    { header: 'Checked In At', key: 'checkedInAt', width: 20 },
    ...event.formFields.map((f) => ({ header: f.label, key: `form_${f.key}`, width: 20 })),
  ];

  const rows = bookings.map((b) => ({
    name: b.user?.name || '(deleted member)',
    mobile: b.user?.mobile || '',
    email: b.user?.email || '',
    seats: b.seats,
    amount: b.amount,
    status: b.refundRequired ? 'refund needed' : b.status,
    paymentId: b.razorpayPaymentId || '',
    paidAt: b.paidAt || '',
    checkedInAt: b.checkedInAt || '',
    ...Object.fromEntries(event.formFields.map((f) => [`form_${f.key}`, b.formData?.[f.key] ?? ''])),
  }));

  await sendExcel(res, `event-${event._id}-bookings.xlsx`, columns, rows);
};
