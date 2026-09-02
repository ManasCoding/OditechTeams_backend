const express = require('express');
const router = express.Router();
const path = require('path');
const EmployeeFile = require('../models/EmployeeFile');
const { deleteFile, getFilePath } = require('../services/fileStorageService');

// Middleware check is done in server.js before calling this router

// GET /api/admin/files/stats
router.get('/stats', async (req, res) => {
  try {
    const totalFiles = await EmployeeFile.countDocuments();
    
    const uniqueEmployees = await EmployeeFile.distinct('employeeId');
    
    // Uploaded today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const uploadedToday = await EmployeeFile.countDocuments({ uploadedAt: { $gte: startOfToday } });
    
    // Total storage used
    const aggregation = await EmployeeFile.aggregate([
      { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
    ]);
    const storageUsedBytes = aggregation.length > 0 ? aggregation[0].totalSize : 0;
    
    let storageUsed = '0 B';
    if (storageUsedBytes > 1024 * 1024 * 1024) {
      storageUsed = (storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    } else if (storageUsedBytes > 1024 * 1024) {
      storageUsed = (storageUsedBytes / (1024 * 1024)).toFixed(2) + ' MB';
    } else if (storageUsedBytes > 1024) {
      storageUsed = (storageUsedBytes / 1024).toFixed(2) + ' KB';
    } else {
      storageUsed = storageUsedBytes + ' B';
    }

    res.status(200).json({
      success: true,
      data: {
        totalFiles,
        employeesWithDocuments: uniqueEmployees.length,
        uploadedToday,
        storageUsed
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/files (with pagination and search)
router.get('/', async (req, res) => {
  try {
    const { search, documentType, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { employeeName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { originalFileName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (documentType) {
      query.documentType = documentType;
    }

    const files = await EmployeeFile.find(query)
      .sort({ uploadedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await EmployeeFile.countDocuments(query);

    res.status(200).json({
      success: true,
      data: files,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin files list error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/files/:id
router.get('/:id', async (req, res) => {
  try {
    const file = await EmployeeFile.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found.' });
    res.status(200).json({ success: true, data: file });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/files/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const file = await EmployeeFile.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'This document is no longer available.' });
    
    const filePath = getFilePath(file.storageKey);
    res.download(filePath, file.originalFileName); // Suggests original filename to client
  } catch (error) {
    console.error('Admin download error:', error);
    res.status(500).json({ success: false, message: 'Server error during download.' });
  }
});

// GET /api/admin/files/:id/preview
router.get('/:id/preview', async (req, res) => {
  try {
    const file = await EmployeeFile.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'This document is no longer available.' });
    
    // Only allow inline preview for certain safe types
    const safeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!safeTypes.includes(file.mimeType)) {
      return res.status(400).json({ success: false, message: 'Preview not supported for this file type.' });
    }

    const filePath = getFilePath(file.storageKey);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalFileName}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Admin preview error:', error);
    res.status(500).json({ success: false, message: 'Server error during preview.' });
  }
});

// DELETE /api/admin/files/:id
router.delete('/:id', async (req, res) => {
  try {
    const file = await EmployeeFile.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found.' });

    // Remove from storage
    await deleteFile(file.storageKey);

    // Remove from DB
    await EmployeeFile.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Admin delete error:', error);
    res.status(500).json({ success: false, message: 'Server error during deletion.' });
  }
});

module.exports = router;
