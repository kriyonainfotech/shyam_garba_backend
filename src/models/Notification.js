import mongoose from 'mongoose';

// A message shown in every member's notification list (and sent as push)
const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 100 },
    body: { type: String, required: [true, 'Message is required'], trim: true, maxlength: 1000 },
    type: { type: String, enum: ['announcement', 'event'], default: 'announcement' },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    devicesReached: { type: Number, default: 0 },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
