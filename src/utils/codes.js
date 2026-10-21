import crypto from 'node:crypto';

// No 0/O or 1/I, so codes are easy to read and type
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Short secret code an admin shares with scanner volunteers, e.g. "K7QM2XPA"
export const generateScanCode = (length = 8) =>
  Array.from(crypto.randomBytes(length), (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join('');

// Long random value shown as a QR code on the member's pass
export const generatePassCode = () => crypto.randomBytes(16).toString('hex');
