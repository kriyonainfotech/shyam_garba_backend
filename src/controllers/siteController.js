import SiteItem, { SITE_ITEM_TYPES } from '../models/SiteItem.js';
import SiteSettings from '../models/SiteSettings.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';
import sendExcel from '../utils/excel.js';
import { getPagination, pageMeta } from '../utils/pagination.js';
import { asString } from '../utils/query.js';

// Settings parts the admin may change (everything except _id / timestamps)
const SETTINGS_FIELDS = [
  'siteName',
  'tagline',
  'logo',
  'theme',
  'hero',
  'sections',
  'featured',
  'about',
  'coursesHead',
  'locationsHead',
  'testimonialsHead',
  'teamHead',
  'eventsHead',
  'galleryHead',
  'featuresHead',
  'venuesHead',
  'faqHead',
  'contactHead',
  'app',
  'footer',
];

const ITEM_FIELDS = ['type', 'title', 'subtitle', 'text', 'image', 'image2', 'icon', 'linkText', 'link', 'order', 'isActive'];

const pick = (body = {}, fields) =>
  Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

// There is only one settings document; it is created the first time it is needed
export const loadSettings = async () => (await SiteSettings.findOne()) || SiteSettings.create({});

// ---------- Settings ----------

// GET /api/admin/site/settings
export const getSettings = async (req, res) => {
  res.status(200).json({ success: true, settings: await loadSettings() });
};

// PUT /api/admin/site/settings  - any of SETTINGS_FIELDS
export const updateSettings = async (req, res) => {
  const settings = await loadSettings();
  settings.set(pick(req.body, SETTINGS_FIELDS));
  await settings.save();

  await logActivity(req.user._id, 'admin.website_update', 'Updated website settings');
  res.status(200).json({ success: true, settings });
};

// ---------- Items (slides, courses, locations, ...) ----------

// GET /api/admin/site/items?type=course
export const getItems = async (req, res) => {
  const type = asString(req.query.type);
  if (type && !SITE_ITEM_TYPES.includes(type)) throw new AppError('Invalid item type', 400);

  const items = await SiteItem.find(type ? { type } : {}).sort({ type: 1, order: 1, createdAt: 1 });
  res.status(200).json({ success: true, count: items.length, items });
};

// POST /api/admin/site/items
export const createItem = async (req, res) => {
  const item = await SiteItem.create(pick(req.body, ITEM_FIELDS));

  await logActivity(req.user._id, 'admin.website_update', `Added website ${item.type} "${item.title}"`);
  res.status(201).json({ success: true, item });
};

// PUT /api/admin/site/items/:id  (type can't be changed)
export const updateItem = async (req, res) => {
  const item = await SiteItem.findById(req.params.id);
  if (!item) throw new AppError('Item not found', 404);

  const { type: _type, ...changes } = pick(req.body, ITEM_FIELDS);
  item.set(changes);
  await item.save();

  await logActivity(req.user._id, 'admin.website_update', `Updated website ${item.type} "${item.title}"`);
  res.status(200).json({ success: true, item });
};

// DELETE /api/admin/site/items/:id
export const deleteItem = async (req, res) => {
  const item = await SiteItem.findByIdAndDelete(req.params.id);
  if (!item) throw new AppError('Item not found', 404);

  await logActivity(req.user._id, 'admin.website_update', `Deleted website ${item.type} "${item.title}"`);
  res.status(200).json({ success: true, message: 'Item deleted' });
};

// POST /api/admin/site/upload  (multipart field "image") - returns the saved path
export const uploadSiteImage = async (req, res) => {
  res.status(201).json({ success: true, path: req.file.publicPath });
};
