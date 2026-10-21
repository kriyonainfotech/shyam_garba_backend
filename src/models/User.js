import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { BLOOD_GROUPS, locationField, phoneField } from './shared.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot be longer than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    // Only email/password accounts (e.g. the admin) have a password.
    // Members sign in with Google and have a googleId instead.
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned by queries unless asked for explicitly
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // many users can have no googleId
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // New members wait for Super Admin approval before using the app
    status: {
      type: String,
      enum: ['pending', 'approved', 'blocked'],
      default: 'pending',
    },
    approvedAt: Date,

    // ---- Member profile ----
    mobile: phoneField,
    address: { type: String, trim: true, maxlength: 300 },
    area: { type: String, trim: true, maxlength: 100 },
    city: { type: String, trim: true, maxlength: 100 },
    location: locationField,
    bloodGroup: {
      type: String,
      enum: { values: BLOOD_GROUPS, message: 'Invalid blood group' },
    },
    photo: String,
    emergencyContact: {
      name: { type: String, trim: true, maxlength: 50 },
      mobile: phoneField,
    },
    business: {
      name: { type: String, trim: true, maxlength: 100 },
      address: { type: String, trim: true, maxlength: 300 },
      mobile: phoneField,
      category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    },

    // Firebase device tokens for push notifications (one per phone)
    fcmTokens: { type: [String], select: false },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
    toJSON: {
      // Extra safety: secrets are removed even if they were selected
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.googleId;
        delete ret.fcmTokens;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ status: 1, role: 1 });
userSchema.index({ 'business.category': 1 });

// Hash the password before saving, but only when it was changed
userSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compares a plain password with the stored hash
userSchema.methods.matchPassword = function (enteredPassword) {
  if (!this.password) return false; // Google-only account
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
