import { getFirebaseAuth } from '../config/firebase.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';
import generateToken from '../utils/generateToken.js';
import { asString } from '../utils/query.js';

// Shapes the user data we send to the frontend (no password or tokens)
export const toPublicUser = (user) => ({ id: user._id, ...user.toJSON() });

const assertNotBlocked = (user) => {
  if (user.status === 'blocked') {
    throw new AppError('Your account has been blocked. Please contact the admin.', 403);
  }
};

// POST /api/auth/google  (mobile app)
// The app signs in with Google through Firebase and sends us the Firebase ID token.
// New members are created with status "pending" until the admin approves them.
export const googleLogin = async (req, res) => {
  const idToken = asString(req.body?.idToken);
  if (!idToken) {
    throw new AppError('idToken is required', 400);
  }

  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    throw new AppError('Google login is not set up on the server yet', 503);
  }

  let google;
  try {
    google = await firebaseAuth.verifyIdToken(idToken);
  } catch {
    throw new AppError('Invalid or expired Google token, please sign in again', 401);
  }

  if (!google.email || !google.email_verified) {
    throw new AppError('Your Google account email is not verified', 401);
  }

  const email = google.email.toLowerCase();
  let user = await User.findOne({ googleId: google.uid });
  let isNewUser = false;

  if (!user) {
    user = await User.findOne({ email });

    if (user) {
      // Existing account with the same email: link it to this Google account
      user.googleId = google.uid;
      if (!user.photo && google.picture) user.photo = google.picture;
      await user.save();
    } else {
      user = await User.create({
        name: (google.name || email.split('@')[0]).slice(0, 50),
        email,
        googleId: google.uid,
        photo: google.picture,
      });
      isNewUser = true;
      await logActivity(user._id, 'auth.register', `${user.name} registered with Google`);
    }
  }

  assertNotBlocked(user);
  await logActivity(user._id, 'auth.login', `${user.name} logged in with Google`);

  res.status(200).json({
    success: true,
    token: generateToken(user._id),
    isNewUser,
    user: toPublicUser(user),
  });
};

// POST /api/auth/register  (email/password, new account waits for approval)
export const register = async (req, res) => {
  const name = asString(req.body?.name);
  const email = asString(req.body?.email);
  const password = asString(req.body?.password);

  if (!name || !email || !password) {
    throw new AppError('Name, email and password are required', 400);
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError('Email is already registered', 409);
  }

  // role and status are NOT taken from req.body, so nobody can register as admin
  const user = await User.create({ name, email, password });
  await logActivity(user._id, 'auth.register', `${user.name} registered with email`);

  res.status(201).json({
    success: true,
    token: generateToken(user._id),
    user: toPublicUser(user),
  });
};

// POST /api/auth/login  (email/password, used by the admin website)
export const login = async (req, res) => {
  const email = asString(req.body?.email);
  const password = asString(req.body?.password);

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  // Same message for both cases, so attackers cannot find out which emails exist
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  assertNotBlocked(user);
  await logActivity(user._id, 'auth.login', `${user.name} logged in`);

  res.status(200).json({
    success: true,
    token: generateToken(user._id),
    user: toPublicUser(user),
  });
};

// GET /api/auth/me (protected)
export const getMe = async (req, res) => {
  await req.user.populate('business.category', 'name');
  res.status(200).json({ success: true, user: toPublicUser(req.user) });
};

// POST /api/auth/fcm-token (protected)
// The app sends its Firebase device token so we can send push notifications.
export const saveFcmToken = async (req, res) => {
  const token = asString(req.body?.token);
  if (!token) {
    throw new AppError('token is required', 400);
  }

  // Remove it first so it moves to the end, then keep only the 10 newest devices
  await User.updateOne({ _id: req.user._id }, { $pull: { fcmTokens: token } });
  await User.updateOne(
    { _id: req.user._id },
    { $push: { fcmTokens: { $each: [token], $slice: -10 } } }
  );

  res.status(200).json({ success: true, message: 'Device registered for notifications' });
};

// DELETE /api/auth/fcm-token (protected) - call on logout
export const removeFcmToken = async (req, res) => {
  const token = asString(req.body?.token);
  if (!token) {
    throw new AppError('token is required', 400);
  }

  await User.updateOne({ _id: req.user._id }, { $pull: { fcmTokens: token } });
  res.status(200).json({ success: true, message: 'Device removed' });
};
