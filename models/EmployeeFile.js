const mongoose = require('mongoose');

const EmployeeFileSchema = new mongoose.Schema({
  employeeId: {
    type: String, // E.g., user._id or a custom string ID
    required: true,
    index: true,
  },
  employeeName: {
    type: String,
    required: true,
    index: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  originalFileName: {
    type: String,
    required: true,
  },
  documentType: {
    type: String,
    required: true,
    index: true,
  },
  fileType: { // e.g., 'pdf', 'docx'
    type: String,
    required: true,
  },
  mimeType: { // e.g., 'application/pdf'
    type: String,
    required: true,
  },
  fileSize: { // size in bytes
    type: Number,
    required: true,
  },
  storageKey: { // secure internal path or key
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  uploadedBy: {
    type: String, // Typically the user ID
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

module.exports = mongoose.model('EmployeeFile', EmployeeFileSchema);
