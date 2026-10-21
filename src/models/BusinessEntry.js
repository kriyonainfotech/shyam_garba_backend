import mongoose from 'mongoose';

// One piece of business passed between two members.
// fromUser gave business to toUser.
const businessEntrySchema = new mongoose.Schema(
  {
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least 1'],
    },
    date: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 500 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

businessEntrySchema.index({ fromUser: 1, date: -1 });
businessEntrySchema.index({ toUser: 1, date: -1 });

const BusinessEntry = mongoose.model('BusinessEntry', businessEntrySchema);

export default BusinessEntry;
