import Notification from '../models/Notification.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';
import { getPagination, pageMeta } from '../utils/pagination.js';
import sendPush from '../utils/push.js';
import { asString } from '../utils/query.js';

// GET /api/notifications?page=&limit=  - newest first
export const getNotifications = async (req, res) => {
  const pagination = getPagination(req.query);

  const [notifications, total] = await Promise.all([
    Notification.find()
      .select('-sentBy -devicesReached')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Notification.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    count: notifications.length,
    ...pageMeta(total, pagination),
    notifications,
  });
};

// POST /api/notifications (admin) - send an announcement to all approved members
// Body: { title, body }
export const sendAnnouncement = async (req, res) => {
  const title = asString(req.body?.title);
  const body = asString(req.body?.body);
  if (!title || !body) {
    throw new AppError('title and body are required', 400);
  }

  const notification = await Notification.create({
    title,
    body,
    type: 'announcement',
    sentBy: req.user._id,
  });

  const { sent, configured } = await sendPush(
    { role: 'user', status: 'approved' },
    { title, body, data: { type: 'announcement', notificationId: notification._id } }
  );
  notification.devicesReached = sent;
  await notification.save();

  await logActivity(req.user._id, 'admin.announcement', `Sent announcement "${title}"`);

  res.status(201).json({
    success: true,
    notification,
    push: configured ? `Sent to ${sent} device(s)` : 'Push is not set up; saved in the app list only',
  });
};

// DELETE /api/notifications/:id (admin) - removes it from the members' list
export const deleteNotification = async (req, res) => {
  const notification = await Notification.findByIdAndDelete(req.params.id);
  if (!notification) throw new AppError('Notification not found', 404);

  await logActivity(req.user._id, 'admin.notification_delete', `Deleted notification "${notification.title}"`);
  res.status(200).json({ success: true, message: 'Notification deleted' });
};
