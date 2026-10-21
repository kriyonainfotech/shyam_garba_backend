// Creates the Super Admin account (or turns an existing account into admin).
// Usage: npm run create-admin -- <email> <password> [name]
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const [email, password, name = 'Super Admin'] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password> [name]');
  process.exit(1);
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);

  let user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    user.password = password;
  } else {
    user = new User({ name, email, password });
  }
  user.role = 'admin';
  user.status = 'approved';
  await user.save();

  console.log(`Admin ready: ${user.email}`);
} catch (error) {
  console.error('Failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
