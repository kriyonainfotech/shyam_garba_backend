import Venue from '../models/Venue.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';

const VENUE_FIELDS = [
  'name',
  'address',
  'area',
  'city',
  'location',
  'contactPerson',
  'contactNumber',
  'timings',
  'isActive',
];

// Copies only allowed fields from the request body
const pickVenueFields = (body = {}) =>
  Object.fromEntries(VENUE_FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

// GET /api/venues  (Garba class locations)
// Members see active venues. Admin can add ?all=true to include inactive ones.
export const getVenues = async (req, res) => {
  const showAll = req.user.role === 'admin' && req.query.all === 'true';
  const venues = await Venue.find(showAll ? {} : { isActive: true }).sort({ name: 1 });

  res.status(200).json({ success: true, count: venues.length, venues });
};

// GET /api/venues/:id
export const getVenue = async (req, res) => {
  const venue = await Venue.findById(req.params.id);
  if (!venue || (!venue.isActive && req.user.role !== 'admin')) {
    throw new AppError('Venue not found', 404);
  }

  res.status(200).json({ success: true, venue });
};

// POST /api/venues (admin)
export const createVenue = async (req, res) => {
  const venue = await Venue.create(pickVenueFields(req.body));

  await logActivity(req.user._id, 'admin.venue_create', `Created venue "${venue.name}"`);
  res.status(201).json({ success: true, venue });
};

// PUT /api/venues/:id (admin)
export const updateVenue = async (req, res) => {
  const venue = await Venue.findById(req.params.id);
  if (!venue) {
    throw new AppError('Venue not found', 404);
  }

  venue.set(pickVenueFields(req.body));
  await venue.save();

  await logActivity(req.user._id, 'admin.venue_update', `Updated venue "${venue.name}"`);
  res.status(200).json({ success: true, venue });
};

// DELETE /api/venues/:id (admin)
export const deleteVenue = async (req, res) => {
  const venue = await Venue.findByIdAndDelete(req.params.id);
  if (!venue) {
    throw new AppError('Venue not found', 404);
  }

  await logActivity(req.user._id, 'admin.venue_delete', `Deleted venue "${venue.name}"`);
  res.status(200).json({ success: true, message: 'Venue deleted' });
};
