import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOAD_DIR } from '../config/paths.js';

// Deletes a file we stored earlier, e.g. "/uploads/photos/abc.jpg".
// Ignores external URLs (like a Google profile photo) and missing files.
export const deleteUploadedFile = async (publicPath) => {
  if (typeof publicPath !== 'string' || !publicPath.startsWith('/uploads/')) return;

  const filePath = path.resolve(UPLOAD_DIR, publicPath.slice('/uploads/'.length));
  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) return; // never leave the uploads folder

  try {
    await fs.unlink(filePath);
  } catch {
    // file already gone, nothing to do
  }
};
