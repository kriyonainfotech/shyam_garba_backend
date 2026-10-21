import mongoose from 'mongoose';
import { getRazorpay, isValidPaymentSignature, isValidWebhookSignature } from '../config/razorpay.js';
import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';
import {
  PAYMENT_HOLD_MINUTES,
  confirmPaidBooking,
  releaseExpiredBookings,
  releaseSeats,
  reserveSeats,
  validateFormData,
} from '../utils/bookings.js';
import { generatePassCode } from '../utils/codes.js';
import { getPagination, pageMeta } from '../utils/pagination.js';
import { asString } from '../utils/query.js';

const EVENT_SUMMARY = 'title startAt endAt venue bannerImage price status';

// POST /api/bookings
// Body: { eventId, seats, formData }
// Free event  -> booking is confirmed right away.
// Paid event  -> seats are held for 15 minutes and a Razorpay order is returned.
//                The app opens Razorpay checkout, then calls /verify-payment.
export const createBooking = async (req, res) => {
  const { eventId, formData } = req.body ?? {};
  const seats = Number(req.body?.seats ?? 1);

  if (!eventId) {
    throw new AppError('eventId is required', 400);
  }
  if (!mongoose.isValidObjectId(eventId)) {
    throw new AppError('Invalid eventId', 400);
  }

  const event = await Event.findById(eventId);
  if (!event || event.status !== 'published') {
    throw new AppError('Event not found', 404);
  }

  const now = new Date();
  const closesAt = event.bookingDeadline || event.startAt;
  if (closesAt < now) {
    throw new AppError('Booking for this event is closed', 400);
  }

  if (!Number.isInteger(seats) || seats < 1 || seats > event.maxSeatsPerBooking) {
    const max = event.maxSeatsPerBooking;
    throw new AppError(
      max === 1 ? 'You can book only 1 seat for this event' : `You can book between 1 and ${max} seats`,
      400
    );
  }

  const cleanFormData = validateFormData(event.formFields, formData);
  const amount = event.price * seats;
  const razorpay = amount > 0 ? getRazorpay() : null;
  if (amount > 0 && !razorpay) {
    throw new AppError('Online payment is not set up on the server yet', 503);
  }

  await releaseExpiredBookings(event._id);
  if (!(await reserveSeats(event._id, seats))) {
    throw new AppError('Sorry, not enough seats left for this event', 409);
  }

  // Free event: confirmed right away. Paid event: seats held while paying.
  let booking;
  try {
    booking = await Booking.create({
      event: event._id,
      user: req.user._id,
      seats,
      formData: cleanFormData,
      amount,
      status: amount === 0 ? 'confirmed' : 'pending',
      expiresAt:
        amount === 0 ? undefined : new Date(now.getTime() + PAYMENT_HOLD_MINUTES * 60 * 1000),
      passCode: generatePassCode(),
    });
  } catch (error) {
    await releaseSeats(event._id, seats); // don't lose the seats if saving failed
    throw error;
  }

  if (amount === 0) {
    await logActivity(req.user._id, 'booking.confirmed', `Booked ${seats} seat(s) for "${event.title}"`, {
      booking: booking._id,
      event: event._id,
    });

    const saved = await Booking.findById(booking._id).select('+passCode').populate('event', EVENT_SUMMARY);
    return res.status(201).json({ success: true, paymentRequired: false, booking: saved });
  }

  // Paid event: create a Razorpay order for the held seats
  let order;
  try {
    order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay works in paise
      currency: 'INR',
      receipt: booking._id.toString(),
      notes: { bookingId: booking._id.toString(), eventId: event._id.toString() },
    });
  } catch (error) {
    // Undo the hold so the seats are not lost
    await Booking.updateOne({ _id: booking._id }, { status: 'expired' });
    await releaseSeats(event._id, seats);
    console.error('Razorpay order failed:', error.error?.description || error.message);
    throw new AppError('Could not start the payment, please try again', 502);
  }

  booking.razorpayOrderId = order.id;
  await booking.save();
  await logActivity(req.user._id, 'booking.create', `Started booking for "${event.title}"`, {
    booking: booking._id,
    event: event._id,
  });

  res.status(201).json({
    success: true,
    paymentRequired: true,
    booking: await Booking.findById(booking._id).populate('event', EVENT_SUMMARY),
    // Everything the app needs to open Razorpay checkout
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      name: req.user.name,
      email: req.user.email,
      contact: req.user.mobile || '',
    },
  });
};

// POST /api/bookings/verify-payment
// Body: the 3 values Razorpay checkout returns to the app on success
export const verifyPayment = async (req, res) => {
  const orderId = asString(req.body?.razorpay_order_id);
  const paymentId = asString(req.body?.razorpay_payment_id);
  const signature = asString(req.body?.razorpay_signature);

  if (!orderId || !paymentId || !signature) {
    throw new AppError('razorpay_order_id, razorpay_payment_id and razorpay_signature are required', 400);
  }
  if (!getRazorpay()) {
    throw new AppError('Online payment is not set up on the server yet', 503);
  }
  if (!isValidPaymentSignature(orderId, paymentId, signature)) {
    throw new AppError('Payment verification failed', 400);
  }

  const owned = await Booking.exists({ razorpayOrderId: orderId, user: req.user._id });
  if (!owned) {
    throw new AppError('Booking not found', 404);
  }

  const { booking, outcome } = await confirmPaidBooking(orderId, paymentId);
  if (outcome === 'sold_out') {
    throw new AppError(
      'Payment received, but the seats sold out meanwhile. Your money will be refunded.',
      409
    );
  }

  const saved = await Booking.findById(booking._id).select('+passCode').populate('event', EVENT_SUMMARY);
  res.status(200).json({ success: true, booking: saved });
};

// POST /api/payments/webhook  (called by Razorpay's servers, not by the app)
// Confirms bookings even if the app was closed before it called /verify-payment.
export const razorpayWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!Buffer.isBuffer(req.body) || !isValidWebhookSignature(req.body, signature)) {
    throw new AppError('Invalid webhook signature', 400);
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    throw new AppError('Webhook body is not valid JSON', 400);
  }
  if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
    const payment = payload.payload?.payment?.entity;
    if (payment?.order_id) {
      await confirmPaidBooking(payment.order_id, payment.id);
    }
  }

  // Always answer 200 quickly, otherwise Razorpay keeps retrying
  res.status(200).json({ success: true });
};

// GET /api/bookings/my?page=&limit=  (booking history)
export const getMyBookings = async (req, res) => {
  const filter = { user: req.user._id, status: { $in: ['confirmed', 'pending', 'failed'] } };
  const pagination = getPagination(req.query);

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('event', EVENT_SUMMARY)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: bookings.length, ...pageMeta(total, pagination), bookings });
};

// GET /api/bookings/:id  (the member's pass; passCode is shown as a QR code)
export const getBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .select('+passCode')
    .populate('event', EVENT_SUMMARY)
    .populate('user', 'name photo mobile');

  const isOwner = booking && booking.user?._id.equals(req.user._id);
  if (!booking || (!isOwner && req.user.role !== 'admin')) {
    throw new AppError('Booking not found', 404);
  }

  // The pass only works once the booking is confirmed
  const result = booking.toJSON();
  if (booking.status !== 'confirmed') delete result.passCode;

  res.status(200).json({ success: true, booking: result });
};
