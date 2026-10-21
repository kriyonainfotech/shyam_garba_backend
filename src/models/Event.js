import mongoose from 'mongoose';
import { locationField } from './shared.js';

export const FORM_FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'phone', 'date', 'select'];

// One question in the event booking form, created by the admin
const formFieldSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      match: [/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/, 'Form field key must be letters, numbers or _'],
    },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, enum: FORM_FIELD_TYPES, default: 'text' },
    required: { type: Boolean, default: false },
    options: [{ type: String, trim: true }], // only for type "select"
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: 120,
    },
    description: { type: String, trim: true, maxlength: 3000 },
    startAt: { type: Date, required: [true, 'Event date is required'] },
    endAt: Date,
    // Last time to book. If empty, booking is open until the event starts.
    bookingDeadline: Date,
    venue: {
      name: { type: String, required: [true, 'Venue name is required'], trim: true },
      address: { type: String, trim: true },
      location: locationField,
    },
    bannerImage: String,

    price: { type: Number, required: [true, 'Price is required'], min: [0, 'Price cannot be negative'] },
    seatLimit: { type: Number, required: [true, 'Seat limit is required'], min: [1, 'Seat limit must be at least 1'] },
    // Seats taken by confirmed bookings plus pending (unpaid) bookings
    seatsBooked: { type: Number, default: 0, min: 0 },
    maxSeatsPerBooking: { type: Number, default: 1, min: 1, max: 20 },
    formFields: [formFieldSchema],

    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled'],
      default: 'draft',
    },

    // Volunteers who enter this code in the app get scanning access
    scanCode: { type: String, unique: true, sparse: true, select: false },
    scanners: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], select: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

eventSchema.index({ status: 1, startAt: 1 });

eventSchema.virtual('seatsLeft').get(function () {
  return Math.max(0, this.seatLimit - this.seatsBooked);
});

eventSchema.pre('validate', function () {
  const keys = this.formFields.map((f) => f.key);
  if (new Set(keys).size !== keys.length) {
    this.invalidate('formFields', 'Each form field must have a different key');
  }
  this.formFields.forEach((field, i) => {
    if (field.type === 'select' && field.options.length === 0) {
      this.invalidate(`formFields.${i}.options`, `Form field "${field.label}" needs options`);
    }
  });
  if (this.endAt && this.endAt < this.startAt) {
    this.invalidate('endAt', 'End time must be after start time');
  }
  if (this.seatLimit < this.seatsBooked) {
    this.invalidate('seatLimit', `Seat limit cannot be less than seats already booked (${this.seatsBooked})`);
  }
});

const Event = mongoose.model('Event', eventSchema);

export default Event;
