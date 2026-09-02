const express = require('express');
const router = express.Router();
const path = require('path');
const EmployeeFile = require('../models/EmployeeFile');
const User = require('../models/User');
const { upload, deleteFile, getFilePath } = require('../services/fileStorageService');

// POST /api/files/upload
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'File size must be less than ' + (process.env.MAX_FILE_SIZE_MB || 10) + ' MB.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    // Fetch full user to get name and formatted ID
    const user = await User.findById(req.user.id);
    if (!user) {
      // Cleanup uploaded file since user is not found
      await deleteFile(req.file.filename);
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const newFile = new EmployeeFile({
      employeeId: user.employeeId || user._id.toString(),
      employeeName: user.fullName || 'Unknown',
      fileName: req.file.filename,
      originalFileName: req.file.originalname,
      documentType: req.body.documentType || 'Other',
      fileType: path.extname(req.file.originalname).replace('.', '').toLowerCase(),
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storageKey: req.file.filename,
      description: req.body.description || '',
      uploadedBy: user._id.toString()
    });

    await newFile.save();

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: newFile
    });
  } catch (error) {
    console.error('File upload error:', error);
    // Attempt to delete if DB save failed
    if (req.file) {
      await deleteFile(req.file.filename).catch(() => {});
    }
    res.status(500).json({ success: false, message: 'Server error during upload.' });
  }
});

// GET /api/files/my-files
router.get('/my-files', async (req, res) => {
  try {
    const files = await EmployeeFile.find({ uploadedBy: req.user.id }).sort({ uploadedAt: -1 });
    res.status(200).json({ success: true, data: files });
  } catch (error) {
    console.error('Get my-files error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/files/:id
router.get('/:id', async (req, res) => {
  try {
    const file = await EmployeeFile.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found.' });
    
    // Verify ownership
    if (file.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "You don't have permission to access this document." });
    }

    res.status(200).json({ success: true, data: file });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/files/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const file = await EmployeeFile.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'This document is no longer available.' });
    
    // Verify ownership
    if (file.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "You don't have permission to access this document." });
    }

    const filePath = getFilePath(file.storageKey);
    res.download(filePath, file.originalFileName); // Send file to user
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, message: 'Server error during download.' });
  }
});

// DELETE /api/files/:id
router.delete('/:id', async (req, res) => {
  try {
    const file = await EmployeeFile.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found.' });

    // Verify ownership
    if (file.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "You don't have permission to delete this document." });
    }

    // Remove from storage
    await deleteFile(file.storageKey);

    // Remove from DB
    await EmployeeFile.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: 'Server error during deletion.' });
  }
});

module.exports = router;
