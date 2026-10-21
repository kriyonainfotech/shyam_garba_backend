import Activity from '../models/Activity.js';
import Booking from '../models/Booking.js';
import BusinessEntry from '../models/BusinessEntry.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';
import sendExcel from '../utils/excel.js';
import { deleteUploadedFile } from '../utils/files.js';
import { releaseSeats } from '../utils/bookings.js';
import buildMemberFilter from '../utils/memberFilter.js';
import { getPagination, pageMeta } from '../utils/pagination.js';
import { applyProfileUpdates } from '../utils/profile.js';
import sendPush from '../utils/push.js';
import { asString } from '../utils/query.js';

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// Member filter + optional ?status=pending|approved|blocked
const adminMemberFilter = (query) => {
  const filter = buildMemberFilter(query);
  const status = asString(query.status);
  // null also matches old accounts saved before "status" existed
  if (status) filter.status = status === 'pending' ? { $in: ['pending', null] } : status;
  return filter;
};

const findMemberOr404 = async (id) => {
  const member = await User.findOne({ _id: id, role: 'user' });
  if (!member) throw new AppError('Member not found', 404);
  return member;
};

// GET /api/admin/dashboard
export const getDashboard = async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [memberCounts, newLast7Days, newLast30Days, upcomingEvents, bookingTotals, monthCollection] =
    await Promise.all([
      // Old accounts saved before "status" existed count as pending (the model default)
      User.aggregate([
        { $match: { role: 'user' } },
        { $group: { _id: { $ifNull: ['$status', 'pending'] }, count: { $sum: 1 } } },
      ]),
      User.countDocuments({ role: 'user', createdAt: { $gte: daysAgo(7) } }),
      User.countDocuments({ role: 'user', createdAt: { $gte: daysAgo(30) } }),
      Event.find({ status: 'published', startAt: { $gte: now } }).sort({ startAt: 1 }).limit(5),
      Booking.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: null, bookings: { $sum: 1 }, seats: { $sum: '$seats' }, amount: { $sum: '$amount' } } },
      ]),
      Booking.aggregate([
        { $match: { status: 'confirmed', paidAt: { $gte: startOfMonth } } },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]),
    ]);

  const members = Object.fromEntries(memberCounts.map((m) => [m._id, m.count]));

  res.status(200).json({
    success: true,
    dashboard: {
      members: {
        total: memberCounts.reduce((sum, m) => sum + m.count, 0),
        approved: members.approved || 0,
        pending: members.pending || 0,
        blocked: members.blocked || 0,
      },
      newRegistrations: { last7Days: newLast7Days, last30Days: newLast30Days },
      upcomingEvents: {
        count: await Event.countDocuments({ status: 'published', startAt: { $gte: now } }),
        next: upcomingEvents,
      },
      bookings: {
        confirmed: bookingTotals[0]?.bookings || 0,
        seats: bookingTotals[0]?.seats || 0,
      },
      payments: {
        totalCollected: bookingTotals[0]?.amount || 0,
        thisMonth: monthCollection[0]?.amount || 0,
      },
    },
  });
};

// GET /api/admin/members?status=&q=&category=&area=&bloodGroup=&page=&limit=
export const getMembers = async (req, res) => {
  const filter = adminMemberFilter(req.query);
  const pagination = getPagination(req.query);

  const [members, total] = await Promise.all([
    User.find(filter)
      .populate('business.category', 'name')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: members.length, ...pageMeta(total, pagination), members });
};

// GET /api/admin/members/export  (same filters as the list) - Excel file
export const exportMembers = async (req, res) => {
  const members = await User.find(adminMemberFilter(req.query))
    .populate('business.category', 'name')
    .sort({ name: 1 });

  const columns = [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Mobile', key: 'mobile', width: 15 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Blood Group', key: 'bloodGroup', width: 12 },
    { header: 'Address', key: 'address', width: 35 },
    { header: 'Area', key: 'area', width: 15 },
    { header: 'City', key: 'city', width: 15 },
    { header: 'Emergency Contact', key: 'emergencyName', width: 20 },
    { header: 'Emergency Number', key: 'emergencyMobile', width: 15 },
    { header: 'Business Name', key: 'businessName', width: 25 },
    { header: 'Business Category', key: 'businessCategory', width: 20 },
    { header: 'Business Number', key: 'businessMobile', width: 15 },
    { header: 'Business Address', key: 'businessAddress', width: 35 },
    { header: 'Joined On', key: 'createdAt', width: 20 },
  ];

  const rows = members.map((m) => ({
    name: m.name,
    email: m.email,
    mobile: m.mobile || '',
    status: m.status,
    bloodGroup: m.bloodGroup || '',
    address: m.address || '',
    area: m.area || '',
    city: m.city || '',
    emergencyName: m.emergencyContact?.name || '',
    emergencyMobile: m.emergencyContact?.mobile || '',
    businessName: m.business?.name || '',
    businessCategory: m.business?.category?.name || '',
    businessMobile: m.business?.mobile || '',
    businessAddress: m.business?.address || '',
    createdAt: m.createdAt,
  }));

  await sendExcel(res, 'members.xlsx', columns, rows);
};

// GET /api/admin/members/:id  - full details with booking and business totals
export const getMember = async (req, res) => {
  const member = await findMemberOr404(req.params.id);
  await member.populate('business.category', 'name');

  const [bookings, given, received] = await Promise.all([
    Booking.find({ user: member._id }).populate('event', 'title startAt').sort({ createdAt: -1 }).limit(20),
    BusinessEntry.aggregate([
      { $match: { fromUser: member._id } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    BusinessEntry.aggregate([
      { $match: { toUser: member._id } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    member,
    recentBookings: bookings,
    business: {
      given: { total: given[0]?.total || 0, count: given[0]?.count || 0 },
      received: { total: received[0]?.total || 0, count: received[0]?.count || 0 },
    },
  });
};

// PATCH /api/admin/members/:id/status
// Body: { status: "approved" | "blocked" | "pending" }
export const updateMemberStatus = async (req, res) => {
  const status = asString(req.body?.status);
  if (!['approved', 'blocked', 'pending'].includes(status)) {
    throw new AppError('status must be approved, blocked or pending', 400);
  }

  const member = await findMemberOr404(req.params.id);
  const wasApproved = member.status === 'approved';

  member.status = status;
  if (status === 'approved' && !member.approvedAt) member.approvedAt = new Date();
  await member.save();

  await logActivity(req.user._id, 'admin.member_status', `Set ${member.name} to ${status}`, {
    member: member._id,
  });

  if (status === 'approved' && !wasApproved) {
    sendPush(
      { _id: member._id },
      {
        title: 'Welcome to Shyam Garba!',
        body: 'Your account has been approved. You can now use the app.',
        data: { type: 'approved' },
      }
    ).catch((err) => console.error('Push failed:', err.message));
  }

  res.status(200).json({ success: true, member });
};

// PUT /api/admin/members/:id  - edit a member's profile
export const updateMember = async (req, res) => {
  const member = await findMemberOr404(req.params.id);

  await applyProfileUpdates(member, req.body ?? {});
  await member.save();
  await member.populate('business.category', 'name');

  await logActivity(req.user._id, 'admin.member_update', `Edited profile of ${member.name}`, {
    member: member._id,
  });
  res.status(200).json({ success: true, member });
};

// DELETE /api/admin/members/:id
// Bookings and business entries are kept for reports.
export const deleteMember = async (req, res) => {
  const member = await findMemberOr404(req.params.id);

  await member.deleteOne();
  await deleteUploadedFile(member.photo);

  await logActivity(req.user._id, 'admin.member_delete', `Deleted member ${member.name} (${member.email})`);
  res.status(200).json({ success: true, message: 'Member deleted' });
};

// GET /api/admin/activity?user=&action=&page=&limit=
export const getActivity = async (req, res) => {
  const filter = {};
  const user = asString(req.query.user);
  const action = asString(req.query.action);
  if (user) filter.user = user;
  if (action) filter.action = action;

  const pagination = getPagination(req.query, 50);
  const [activities, total] = await Promise.all([
    Activity.find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Activity.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: activities.length, ...pageMeta(total, pagination), activities });
};

// Turns ?from=&to= into a date filter
const dateRange = (query, field) => {
  const range = {};
  const from = asString(query.from);
  const to = asString(query.to);
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  if (Object.values(range).some((d) => Number.isNaN(d.getTime()))) {
    throw new AppError('from/to must be valid dates', 400);
  }
  return Object.keys(range).length ? { [field]: range } : {};
};

// Top members by business given or received
const topMembers = (match, groupField, limit = 10) =>
  BusinessEntry.aggregate([
    { $match: match },
    { $group: { _id: `$${groupField}`, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: limit },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'member' } },
    { $unwind: { path: '$member', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, memberId: '$_id', name: '$member.name', photo: '$member.photo', total: 1, count: 1 } },
  ]);

// GET /api/admin/business/report?from=&to=  - community-wide business report
export const getBusinessReport = async (req, res) => {
  const match = dateRange(req.query, 'date');

  const [totals, topGivers, topReceivers, recent] = await Promise.all([
    BusinessEntry.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    topMembers(match, 'fromUser'),
    topMembers(match, 'toUser'),
    BusinessEntry.find(match)
      .populate('fromUser', 'name')
      .populate('toUser', 'name')
      .sort({ date: -1 })
      .limit(20),
  ]);

  res.status(200).json({
    success: true,
    report: {
      totalAmount: totals[0]?.total || 0,
      totalEntries: totals[0]?.count || 0,
      topGivers,
      topReceivers,
      recentEntries: recent,
    },
  });
};

// GET /api/admin/payments?status=&event=&refundRequired=true&from=&to=&page=&limit=
export const getPayments = async (req, res) => {
  const filter = { amount: { $gt: 0 }, ...dateRange(req.query, 'createdAt') };
  const status = asString(req.query.status);
  const event = asString(req.query.event);
  if (status) filter.status = status;
  if (event) filter.event = event;
  if (req.query.refundRequired === 'true') filter.refundRequired = true;

  const pagination = getPagination(req.query, 50);
  const [payments, total] = await Promise.all([
    Booking.find(filter)
      .populate('user', 'name mobile email')
      .populate('event', 'title startAt')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: payments.length, ...pageMeta(total, pagination), payments });
};

// GET /api/admin/events/report  - bookings, collection and entries for every event
export const getEventsReport = async (req, res) => {
  const report = await Event.aggregate([
    { $sort: { startAt: -1 } },
    {
      $lookup: {
        from: 'bookings',
        let: { eventId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$event', '$$eventId'] }, status: 'confirmed' } },
          {
            $group: {
              _id: null,
              bookings: { $sum: 1 },
              seats: { $sum: '$seats' },
              collected: { $sum: '$amount' },
              checkedInSeats: { $sum: { $cond: [{ $ifNull: ['$checkedInAt', false] }, '$seats', 0] } },
            },
          },
        ],
        as: 'totals',
      },
    },
    { $unwind: { path: '$totals', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        title: 1,
        startAt: 1,
        status: 1,
        price: 1,
        seatLimit: 1,
        seatsLeft: { $max: [0, { $subtract: ['$seatLimit', '$seatsBooked'] }] },
        bookings: { $ifNull: ['$totals.bookings', 0] },
        seatsSold: { $ifNull: ['$totals.seats', 0] },
        collected: { $ifNull: ['$totals.collected', 0] },
        checkedInSeats: { $ifNull: ['$totals.checkedInSeats', 0] },
      },
    },
  ]);

  res.status(200).json({ success: true, count: report.length, events: report });
};

// DELETE /api/admin/activity/:id  - remove one line from the activity log
export const deleteActivity = async (req, res) => {
  const activity = await Activity.findByIdAndDelete(req.params.id);
  if (!activity) throw new AppError('Activity not found', 404);
  res.status(200).json({ success: true, message: 'Activity deleted' });
};

// GET /api/admin/business/entries?from=&to=&page=&limit=  - every business entry
export const getBusinessEntries = async (req, res) => {
  const filter = dateRange(req.query, 'date');
  const pagination = getPagination(req.query);

  const [entries, total] = await Promise.all([
    BusinessEntry.find(filter)
      .populate('fromUser', 'name')
      .populate('toUser', 'name')
      .sort({ date: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    BusinessEntry.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: entries.length, ...pageMeta(total, pagination), entries });
};

// DELETE /api/admin/business/entries/:id
export const deleteBusinessEntry = async (req, res) => {
  const entry = await BusinessEntry.findByIdAndDelete(req.params.id);
  if (!entry) throw new AppError('Entry not found', 404);

  await logActivity(req.user._id, 'admin.business_delete', `Deleted a ₹${entry.amount} business entry`);
  res.status(200).json({ success: true, message: 'Entry deleted' });
};

// DELETE /api/admin/bookings/:id
// Seats held by a pending or confirmed booking go back to the event.
// Refunds (if any) must be done from the Razorpay dashboard.
export const deleteBooking = async (req, res) => {
  const booking = await Booking.findByIdAndDelete(req.params.id).populate('user', 'name');
  if (!booking) throw new AppError('Booking not found', 404);

  if (['pending', 'confirmed'].includes(booking.status)) {
    await releaseSeats(booking.event, booking.seats);
  }

  await logActivity(
    req.user._id,
    'admin.booking_delete',
    `Deleted a ${booking.status} booking of ${booking.user?.name || 'a deleted member'} (${booking.seats} seat(s), ₹${booking.amount})`,
    { event: booking.event }
  );
  res.status(200).json({ success: true, message: 'Booking deleted' });
};
