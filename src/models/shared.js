// Small pieces reused by several models

// Indian mobile number: 10 digits starting with 6-9, optionally with +91 / 91 in front
export const phoneField = {
  type: String,
  trim: true,
  match: [
    /^(\+?91)?[6-9][0-9]{9}$/,
    'Please provide a valid 10-digit mobile number starting with 6, 7, 8 or 9',
  ],
};

// Map position. Stored as plain lat/lng so the mobile app can use it directly.
export const locationField = {
  lat: { type: Number, min: [-90, 'Invalid latitude'], max: [90, 'Invalid latitude'] },
  lng: { type: Number, min: [-180, 'Invalid longitude'], max: [180, 'Invalid longitude'] },
};

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
