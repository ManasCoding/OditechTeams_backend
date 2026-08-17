const mongoose = require('mongoose');

const meetingParticipantSchema = new mongoose.Schema({
  meetingId: {
    type: String, // String or ObjectId, sticking to String to match 'room-id' convention
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: 'Unknown'
  },
  profileImage: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['host', 'participant'],
    default: 'participant'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'joined', 'left', 'removed'],
    default: 'pending'
  },
  micEnabled: {
    type: Boolean,
    default: true
  },
  cameraEnabled: {
    type: Boolean,
    default: true
  },
  joinedAt: {
    type: Date,
    default: null
  },
  leftAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('MeetingParticipant', meetingParticipantSchema);
