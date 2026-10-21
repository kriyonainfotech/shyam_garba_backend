import jwt from 'jsonwebtoken';

// Creates a signed JWT that contains only the user's id.
// Never put passwords or other sensitive data inside a token.
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

export default generateToken;
