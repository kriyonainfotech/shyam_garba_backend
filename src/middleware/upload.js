import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { UPLOAD_DIR } from '../config/paths.js';
import AppError from '../utils/AppError.js';

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Accepts one image from the form field `fieldName` and saves it in
// uploads/<folder>/ with a random file name. Max size is `maxMb` (default 2 MB).
// The saved path is available as req.file.publicPath, e.g. "/uploads/photos/ab12.jpg"
const uploadImage = (folder, fieldName, maxMb = 2) => {
  const dir = path.join(UPLOAD_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) => {
        cb(null, crypto.randomBytes(16).toString('hex') + EXTENSIONS[file.mimetype]);
      },
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!EXTENSIONS[file.mimetype]) {
        return cb(new AppError('Only JPG, PNG or WEBP images are allowed', 400));
      }
      cb(null, true);
    },
  }).single(fieldName);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) return next(new AppError(`Please upload an image in the "${fieldName}" field`, 400));
      req.file.publicPath = `/uploads/${folder}/${req.file.filename}`;
      next();
    });
  };
};

export default uploadImage;
