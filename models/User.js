const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin', 'Super Admin', 'Admin', 'Manager', 'Member'],
    default: 'user'
  },
  fullName: { type: String, required: true },
  employeeCode: { type: String, required: true, unique: true },
  department: { type: String },
  designation: { type: String },
  avatar: { type: String, default: '' },
  phone: { type: String, default: '' },
  bio: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
