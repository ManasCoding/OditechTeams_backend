const mongoose = require('mongoose');

// Per-user reaction subdocument
const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { _id: false });

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
    trim: true,
    default: ''
  },

  // ── File / Attachment ─────────────────────────────────────
  fileUrl:  { type: String, default: '' },
  fileType: {
    type: String,
    enum: ['text', 'image', 'video', 'document', 'audio', 'file'],
    default: 'text'
  },
  fileName: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },

  // ── Status lifecycle ──────────────────────────────────────
  // Primary status (used by new UI)
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'seen', 'read', 'failed'],
    default: 'sent'
  },
  // Legacy alias kept for backward compat
  messageStatus: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  },
  sentAt:      { type: Date, default: Date.now },
  deliveredAt: { type: Date, default: null },
  seenAt:      { type: Date, default: null },
  readAt:      { type: Date, default: null },

  // ── Per-User Tracking (for Group Chats) ───────────────────
  deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  readBy:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // ── Reply-to ──────────────────────────────────────────────
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },

  // ── Reactions (per-user, multiple emojis) ─────────────────
  reactions: { type: [reactionSchema], default: [] },

  // ── Optimistic de-duplication ─────────────────────────────
  clientMessageId: { type: String, default: '' },

  // ── Edit / Delete ─────────────────────────────────────────
  isEdited:  { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },

  // ── Legacy channel message fields ─────────────────────────
  author:         { type: String, default: 'Unknown' },
  authorInitials: { type: String, default: '??' },
  authorAvatar:   { type: String, default: '' },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
