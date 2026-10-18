/**
 * EcoTrack Image Upload Middleware (Multer)
 * Validates file type, extension, size, and generates safe random filenames.
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'waste');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration with safe random filenames
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = 'waste-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext;
    cb(null, randomName);
  }
});

// File filter for allowed image types (JPEG, PNG, WebP)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  // Block dangerous extensions explicitly
  const dangerousExts = ['.php', '.js', '.html', '.htm', '.exe', '.sh', '.bat', '.cmd', '.py', '.jsp', '.asp'];
  if (dangerousExts.includes(ext)) {
    return cb(new Error('Invalid file type. Executable and script files are strictly prohibited.'), false);
  }

  if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP image formats are accepted.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max file size
  }
});

module.exports = upload;
