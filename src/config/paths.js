import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Uploaded images (member photos, event banners) are stored here
// and served at /uploads/...
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
