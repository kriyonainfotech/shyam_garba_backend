import { getFirebaseMessaging } from '../config/firebase.js';
import User from '../models/User.js';

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

// Sends a push notification to every user matching `filter`.
// Returns how many devices received it. Does nothing if Firebase is not set up.
const sendPush = async (filter, { title, body, data = {} }) => {
  const messaging = getFirebaseMessaging();
  if (!messaging) return { sent: 0, configured: false };

  const users = await User.find(filter).select('+fcmTokens');
  const tokens = [...new Set(users.flatMap((u) => u.fcmTokens || []))];

  // FCM only accepts string values in `data`
  const stringData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value)])
  );

  let sent = 0;
  const invalidTokens = [];

  // FCM accepts at most 500 tokens per call
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: stringData,
      });
      sent += result.successCount;
      result.responses.forEach((r, index) => {
        if (!r.success && INVALID_TOKEN_CODES.has(r.error?.code)) {
          invalidTokens.push(batch[index]);
        }
      });
    } catch (error) {
      console.error('Push notification failed:', error.message);
    }
  }

  // Remove tokens of uninstalled apps so we stop sending to them
  if (invalidTokens.length > 0) {
    await User.updateMany({}, { $pull: { fcmTokens: { $in: invalidTokens } } });
  }

  return { sent, configured: true };
};

export default sendPush;
