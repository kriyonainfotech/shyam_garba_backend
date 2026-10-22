import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Uploaded images (member photos, event banners) are stored here
// and served at /uploads/...
// On Vercel only /tmp can be written to (and it is wiped regularly).
export const UPLOAD_DIR = process.env.VERCEL
  ? '/tmp/uploads'
  : path.resolve(__dirname, '../../uploads');
