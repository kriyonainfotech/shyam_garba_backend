// Escapes special characters so user text can be used safely inside a RegExp
export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Case-insensitive "contains" search
export const containsRegex = (text) => new RegExp(escapeRegex(text), 'i');

// Returns the value only if it is a non-empty string.
// Blocks values like ?q[$ne]=1 that arrive as objects instead of text.
export const asString = (value) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

// True for a plain object like { a: 1 } (not an array, string or null)
export const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
