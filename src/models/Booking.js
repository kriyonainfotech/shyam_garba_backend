import mongoose from 'mongoose';

// A member's seat booking for an event. Also acts as the entry pass.
const bookingSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seats: { type: Number, required: true, min: 1 },
    formData: { type: mongoose.Schema.Types.Mixed, default: {} }, // answers to event.formFields
    amount: { type: Number, required: true, min: 0 }, // total in rupees

    // pending   -> waiting for payment (seats are held until expiresAt)
    // confirmed -> paid (or free event), pass is valid
    // expired   -> not paid in time, seats released
    // failed    -> paid, but seats ran out; needs a refund (refundRequired)
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'expired', 'failed'],
      default: 'pending',
    },
    expiresAt: Date,
    refundRequired: { type: Boolean, default: false },

    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: String,
    paidAt: Date,

    // Value inside the QR code. Only shown to the member once confirmed.
    passCode: { type: String, required: true, unique: true, select: false },
    checkedInAt: Date,
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

bookingSchema.index({ event: 1, status: 1 });
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ status: 1, expiresAt: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
