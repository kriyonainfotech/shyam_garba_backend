import Activity from '../models/Activity.js';

// Saves one line in the activity log. Never throws: a logging failure
// must not break the request that triggered it.
const logActivity = async (userId, action, description, meta = {}) => {
  try {
    await Activity.create({ user: userId, action, description, meta });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

export default logActivity;
