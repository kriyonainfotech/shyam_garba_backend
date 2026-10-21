import AppError from '../utils/AppError.js';

// Runs when no route matched the request URL.
export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// "Cast to Number failed for value ..." -> "price must be a number"
const castMessage = (path, kind = '') => {
  const field = path === '_id' ? 'id' : path;
  const type = kind.toLowerCase();
  if (type === 'number') return `${field} must be a number`;
  if (type === 'date') return `${field} must be a valid date`;
  if (type === 'boolean') return `${field} must be true or false`;
  if (type === 'objectid') return `Invalid ${field}`;
  return `${field} has an invalid format`;
};

// One readable line per invalid field
const validationMessage = (e) => {
  if (e.name === 'CastError') return castMessage(e.path, e.kind);
  if (e.kind === 'enum') {
    return `${e.path} must be one of: ${e.properties.enumValues.join(', ')}`;
  }
  return e.message; // our own messages from the schema, e.g. "Price is required"
};

// Converts known library errors into clear messages and status codes
const normalizeError = (err) => {
  // File upload problems (file too large, wrong field name, ...)
  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large, please upload a smaller one' : err.message;
    return { statusCode: 400, message };
  }

  // express.json() could not read the body
  if (err.type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'Request body is not valid JSON' };
  }
  if (err.type === 'entity.too.large') {
    return { statusCode: 413, message: 'Request is too large' };
  }

  // Mongoose schema validation failed (e.g. missing required field)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(validationMessage);
    return { statusCode: 400, message: messages.join(', ') };
  }

  // MongoDB unique index violated (e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Field';
    return { statusCode: 409, message: `This ${field} already exists` };
  }

  // Value of the wrong type, e.g. "abc" as an id in the URL
  if (err.name === 'CastError') {
    return { statusCode: 400, message: castMessage(err.path, err.kind) };
  }

  if (err.name === 'JsonWebTokenError') {
    return { statusCode: 401, message: 'Invalid token, please log in again' };
  }

  if (err.name === 'TokenExpiredError') {
    return { statusCode: 401, message: 'Session expired, please log in again' };
  }

  // err.status is set by express.json() for malformed JSON bodies
  return {
    statusCode: err.statusCode || err.status || 500,
    message: err.message || 'Internal Server Error',
  };
};

// Central error handler. Any error passed to next(error), or thrown inside
// a route, ends up here. Express knows it is an error handler because it
// has 4 parameters.
export const errorHandler = (err, req, res, next) => {
  // If part of the response (e.g. an Excel file) was already sent, we can't
  // send JSON anymore; let Express close the connection.
  if (res.headersSent) {
    console.error(err);
    return next(err);
  }

  const { statusCode, message } = normalizeError(err);

  if (statusCode === 500) {
    console.error(err);
  }

  // Messages we wrote ourselves (AppError) are safe to show.
  // Unexpected errors may contain internal details, so they are hidden.
  const isOurMessage = err instanceof AppError;

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && !isOurMessage ? 'Internal Server Error' : message,
  });
};
