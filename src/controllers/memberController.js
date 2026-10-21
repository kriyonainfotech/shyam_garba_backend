import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import buildMemberFilter from '../utils/memberFilter.js';
import { getPagination, pageMeta } from '../utils/pagination.js';

// What other members can see about a member
const DIRECTORY_FIELDS =
  'name photo mobile address area city bloodGroup business location emergencyContact';

// GET /api/members?q=&category=&area=&bloodGroup=&page=&limit=
// Member directory: only approved members are listed.
export const getMembers = async (req, res) => {
  const filter = { ...buildMemberFilter(req.query), status: 'approved' };
  const pagination = getPagination(req.query);

  const [members, total] = await Promise.all([
    User.find(filter)
      .select(DIRECTORY_FIELDS)
      .populate('business.category', 'name')
      .sort({ name: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: members.length,
    ...pageMeta(total, pagination),
    members,
  });
};

// GET /api/members/map
// Every approved member who has set a map location (for the members map)
export const getMembersMap = async (req, res) => {
  const members = await User.find({
    role: 'user',
    status: 'approved',
    'location.lat': { $ne: null },
    'location.lng': { $ne: null },
  })
    .select('name photo area city location business.name business.category')
    .populate('business.category', 'name');

  res.status(200).json({ success: true, count: members.length, members });
};

// GET /api/members/:id
export const getMember = async (req, res) => {
  const member = await User.findOne({ _id: req.params.id, role: 'user', status: 'approved' })
    .select(DIRECTORY_FIELDS)
    .populate('business.category', 'name');

  if (!member) {
    throw new AppError('Member not found', 404);
  }

  res.status(200).json({ success: true, member });
};
