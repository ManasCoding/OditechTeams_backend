const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel'
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  text: {
    type: String,
    trim: true
  },
  fileUrl: {
    type: String
  },
  messageStatus: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  },
  author: {
    type: String,
    default: 'Unknown'
  },
  authorInitials: {
    type: String,
    default: '??'
  },
  authorAvatar: {
    type: String,
    default: ''
  },
  reactions: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', messageSchema);
