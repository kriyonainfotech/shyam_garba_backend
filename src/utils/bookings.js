import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import AppError from './AppError.js';
import logActivity from './activity.js';
import { isPlainObject } from './query.js';

// How long seats are held for a member while they pay
export const PAYMENT_HOLD_MINUTES = 15;

// Takes `seats` seats from the event in ONE database operation, so two
// members booking at the same time can never go over the seat limit.
// Returns the updated event, or null if there are not enough seats.
export const reserveSeats = (eventId, seats) =>
  Event.findOneAndUpdate(
    {
      _id: eventId,
      $expr: { $lte: [{ $add: ['$seatsBooked', seats] }, '$seatLimit'] },
    },
    { $inc: { seatsBooked: seats } },
    { new: true }
  );

export const releaseSeats = (eventId, seats) =>
  Event.updateOne({ _id: eventId }, { $inc: { seatsBooked: -seats } });

// Gives back seats held by bookings that were not paid in time.
// Runs before every new booking and every few minutes from server.js.
export const releaseExpiredBookings = async (eventId) => {
  const filter = { status: 'pending', expiresAt: { $lt: new Date() } };
  if (eventId) filter.event = eventId;

  const expired = await Booking.find(filter).select('_id event seats');
  for (const booking of expired) {
    // Only the request that actually flips the status releases the seats
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: 'pending' },
      { status: 'expired' }
    );
    if (updated) await releaseSeats(booking.event, booking.seats);
  }
};

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const PHONE_REGEX = /^(\+?91)?[6-9][0-9]{9}$/; // same rule as models/shared.js

// Checks the member's answers against the event's form fields.
// Returns a clean object containing only the known fields.
export const validateFormData = (formFields, data) => {
  const input = isPlainObject(data) ? data : {};
  const clean = {};

  for (const field of formFields) {
    let value = input[field.key];
    const isEmpty =
      value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

    if (isEmpty) {
      if (field.required) throw new AppError(`"${field.label}" is required`, 400);
      continue;
    }
    if (typeof value === 'object') {
      throw new AppError(`"${field.label}" has an invalid value`, 400);
    }

    const text = String(value).trim();
    switch (field.type) {
      case 'number':
        value = Number(text);
        if (!Number.isFinite(value)) throw new AppError(`"${field.label}" must be a number`, 400);
        break;
      case 'email':
        if (!EMAIL_REGEX.test(text)) throw new AppError(`"${field.label}" must be a valid email`, 400);
        value = text;
        break;
      case 'phone':
        if (!PHONE_REGEX.test(text)) throw new AppError(`"${field.label}" must be a valid phone number`, 400);
        value = text;
        break;
      case 'date':
        if (Number.isNaN(Date.parse(text))) throw new AppError(`"${field.label}" must be a valid date`, 400);
        value = text;
        break;
      case 'select':
        if (!field.options.includes(text)) {
          throw new AppError(`"${field.label}" must be one of: ${field.options.join(', ')}`, 400);
        }
        value = text;
        break;
      default:
        value = text.slice(0, field.type === 'textarea' ? 2000 : 300);
    }
    clean[field.key] = value;
  }

  return clean;
};

// Marks a Razorpay order as paid. Safe to call more than once for the same
// order (the app and the webhook may both report the same payment).
// Returns { booking, outcome } where outcome is
// "confirmed" | "already_confirmed" | "sold_out" | "not_found"
export const confirmPaidBooking = async (orderId, paymentId) => {
  const paidUpdate = { status: 'confirmed', razorpayPaymentId: paymentId, paidAt: new Date() };

  // Normal case: still pending, seats are already held for it
  let booking = await Booking.findOneAndUpdate(
    { razorpayOrderId: orderId, status: 'pending' },
    { ...paidUpdate, $unset: { expiresAt: 1 } },
    { new: true }
  );
  if (booking) {
    await logActivity(booking.user, 'booking.confirmed', 'Payment received, booking confirmed', {
      booking: booking._id,
      event: booking.event,
      amount: booking.amount,
    });
    return { booking, outcome: 'confirmed' };
  }

  booking = await Booking.findOne({ razorpayOrderId: orderId });
  if (!booking) return { booking: null, outcome: 'not_found' };
  if (booking.status === 'confirmed') return { booking, outcome: 'already_confirmed' };
  if (booking.refundRequired) return { booking, outcome: 'sold_out' };

  // Paid after the hold expired: try to get the seats again
  const previousStatus = booking.status;
  if (await reserveSeats(booking.event, booking.seats)) {
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: previousStatus },
      paidUpdate,
      { new: true }
    );
    if (updated) return { booking: updated, outcome: 'confirmed' };

    // Another request handled it at the same moment; give the seats back
    await releaseSeats(booking.event, booking.seats);
    return confirmPaidBooking(orderId, paymentId);
  }

  // No seats left: keep the payment id so the admin can refund it
  await Booking.updateOne(
    { _id: booking._id, status: previousStatus },
    { status: 'failed', refundRequired: true, razorpayPaymentId: paymentId, paidAt: new Date() }
  );
  await logActivity(booking.user, 'booking.refund_required', 'Paid after seats sold out, refund needed', {
    booking: booking._id,
    paymentId,
  });
  return { booking: await Booking.findById(booking._id), outcome: 'sold_out' };
};
