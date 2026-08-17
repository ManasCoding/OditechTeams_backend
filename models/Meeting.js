const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  host: {
    type: String,
    default: 'Unknown'
  },
  hostId: {
    type: String,
    required: true
  },
  scheduledAt: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: String,
    default: '1h'
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed'],
    default: 'upcoming'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Meeting', meetingSchema);
