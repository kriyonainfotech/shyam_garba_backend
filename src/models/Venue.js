import mongoose from 'mongoose';
import { locationField, phoneField } from './shared.js';

// An offline Shyam Garba class location
const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
      trim: true,
      maxlength: 100,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: 300,
    },
    area: { type: String, trim: true, maxlength: 100 },
    city: { type: String, trim: true, maxlength: 100 },
    location: {
      lat: { ...locationField.lat, required: [true, 'Latitude is required'] },
      lng: { ...locationField.lng, required: [true, 'Longitude is required'] },
    },
    contactPerson: { type: String, trim: true, maxlength: 50 },
    contactNumber: phoneField,
    timings: { type: String, trim: true, maxlength: 200 }, // e.g. "Mon-Fri 7pm to 9pm"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Venue = mongoose.model('Venue', venueSchema);

export default Venue;
