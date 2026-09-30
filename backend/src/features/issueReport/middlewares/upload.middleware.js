import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import HttpError from '../../../utils/httpError.utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve target upload directory relative to project root (4 levels up from features/issueReport/middlewares)
const projectRoot = path.resolve(__dirname, '../../../..');
const uploadDir = path.resolve(projectRoot, 'uploads/issueReports');

/** Absolute directory holding issue report screenshots (private; served only via the authenticated endpoint). */
export const UPLOAD_ROOT = uploadDir;

/** Generated attachment file names: rep-<uuid>.<ext> (legacy: rep-<timestamp>-<n>.<ext>) */
export const ATTACHMENT_FILENAME_PATTERN = /^rep-[A-Za-z0-9-]{8,64}\.(jpg|png|webp)$/;

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext || !['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      const mime = (file.mimetype || '').toLowerCase();
      if (mime.includes('png')) ext = '.png';
      else if (mime.includes('webp')) ext = '.webp';
      else ext = '.jpg';
    }
    cb(null, `rep-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/pjpeg',
    'image/x-png',
  ];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  const rawExt = path.extname(file.originalname || '').toLowerCase();
  const normalizedMime = (file.mimetype || '').toLowerCase();

  const isMimeValid = allowedMimeTypes.includes(normalizedMime);
  const isExtValid = allowedExtensions.includes(rawExt);

  if (isMimeValid && isExtValid) {
    cb(null, true);
  } else {
    cb(new HttpError(400, `Security violation: Invalid file type or extension for file ${file.originalname}. Only JPEG, PNG, and WEBP images are permitted.`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Single optional screenshot
  },
});

/**
 * Middleware to verify magic bytes of uploaded image files
 */
export const imageSignatureValidator = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const filePath = req.file.path;
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    let isValid = false;

    // Check PNG magic number: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      isValid = true;
    }
    // Check JPEG magic number: FF D8 FF
    else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      isValid = true;
    }
    // Check WebP magic number: RIFF (52 49 46 46) at 0-3 and WEBP (57 45 42 50) at 8-11
    else {
      const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
      const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
      if (isRiff && isWebp) {
        isValid = true;
      }
    }

    if (!isValid) {
      // Delete the invalid file immediately
      fs.unlink(filePath, (err) => {
        if (err) console.error('[IssueReport Upload] Error deleting file with invalid signature:', err);
      });
      return next(new HttpError(400, 'Security violation: Invalid image signature detected (magic bytes mismatch).'));
    }

    next();
  } catch (err) {
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) console.error('[IssueReport Upload] Error deleting file on signature exception:', unlinkErr);
    });
    next(new HttpError(400, 'Security violation: Failed to verify image headers.'));
  }
};

export default upload;
