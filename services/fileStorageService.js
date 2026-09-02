const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure private_uploads directory exists
const privateUploadsDir = path.join(__dirname, '..', 'private_uploads');
if (!fs.existsSync(privateUploadsDir)) {
  fs.mkdirSync(privateUploadsDir, { recursive: true });
}

// Allowed File Types
const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/zip',
  'application/x-zip-compressed'
];

const maxFileSize = process.env.MAX_FILE_SIZE_MB ? parseInt(process.env.MAX_FILE_SIZE_MB) * 1024 * 1024 : 10 * 1024 * 1024; // Default 10MB

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, privateUploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${req.user?.id || 'unknown'}_${uniqueSuffix}_${safeBaseName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Supported types are PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, ZIP.'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: maxFileSize },
  fileFilter: fileFilter
});

const deleteFile = (storageKey) => {
  const filePath = path.join(privateUploadsDir, storageKey);
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        return reject(err);
      }
      resolve();
    });
  });
};

const getFilePath = (storageKey) => {
  return path.join(privateUploadsDir, storageKey);
};

module.exports = {
  upload,
  deleteFile,
  getFilePath,
  privateUploadsDir
};
