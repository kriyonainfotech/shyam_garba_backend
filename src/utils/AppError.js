// An Error that also carries an HTTP status code.
// Usage: throw new AppError('Email already registered', 409);
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export default AppError;
