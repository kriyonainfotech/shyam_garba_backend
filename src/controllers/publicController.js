import Event from '../models/Event.js';
import SiteItem, { SITE_ITEM_TYPES } from '../models/SiteItem.js';
import User from '../models/User.js';
import Venue from '../models/Venue.js';
import { loadSettings } from './siteController.js';

// GET /api/public/home  - everything the public website needs (no login needed).
// Texts/images come from the admin "Website" section; events and venues from
// their own modules. Only safe, public fields are returned.
export const getHomeData = async (req, res) => {
  const now = new Date();

  const [settings, items, venues, events, members] = await Promise.all([
    loadSettings(),
    SiteItem.find({ isActive: true, type: { $in: SITE_ITEM_TYPES } }).sort({ order: 1, createdAt: 1 }),
    Venue.find({ isActive: true })
      .select('name address area city location contactPerson contactNumber timings')
      .sort({ name: 1 }),
    Event.find({
      status: 'published',
      $or: [{ endAt: { $gte: now } }, { endAt: null, startAt: { $gte: now } }],
    })
      .select('title description startAt endAt venue.name venue.address bannerImage price seatLimit seatsBooked')
      .sort({ startAt: 1 })
      .limit(6),
    User.countDocuments({ role: 'user', status: 'approved' }),
  ]);

  // { slide: [...], course: [...], ... }
  const content = Object.fromEntries(SITE_ITEM_TYPES.map((type) => [type, []]));
  items.forEach((item) => content[item.type].push(item));

  res.status(200).json({
    success: true,
    settings,
    content,
    stats: { members, venues: venues.length, upcomingEvents: events.length },
    venues,
    events,
  });
};
