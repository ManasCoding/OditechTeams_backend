require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Channel = require('./models/Channel');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const Meeting = require('./models/Meeting');
const Call = require('./models/Call');
const MeetingParticipant = require('./models/MeetingParticipant');

// Track connected users: userId -> socketId
const connectedUsers = {};

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Oditech Teams API is running' });
});

// Admin Login Route
app.post('/api/admin/login', async (req, res) => {
  const { email, password, secretKey } = req.body;

  if (secretKey !== '123456') {
    return res.status(401).json({ success: false, message: 'Invalid Secret Admin Key.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Admin not found.' });
    }

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Not an admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'your_jwt_secret_here', { expiresIn: '7d' });

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        employeeCode: user.employeeCode,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Regular User Login Route
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'your_jwt_secret_here', { expiresIn: '7d' });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        employeeCode: user.employeeCode,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Create User Route
app.post('/api/users', async (req, res) => {
  const { fullName, email, password, employeeCode, role, department, designation } = req.body;
  
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { employeeCode }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email or employee code already exists.' });
    }
    
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }
    
    // Hash provided password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      fullName,
      email,
      employeeCode,
      role,
      department,
      designation,
      password: hashedPassword
    });
    
    await newUser.save();
    res.status(201).json({ success: true, message: 'User created successfully.', user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Server error creating user.' });
  }
});

// Auth Middleware
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_here');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Profile Route - GET
app.get('/api/profile', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Profile Route - PUT
app.put('/api/profile', authenticateUser, async (req, res) => {
  try {
    const { fullName, phone, bio, avatar } = req.body;
    console.log('Profile update received:', { fullName, phone, bio, avatar });

    const updateFields = {};
    if (fullName) updateFields.fullName = fullName;
    if (phone !== undefined) updateFields.phone = phone;
    if (bio !== undefined) updateFields.bio = bio;
    if (avatar !== undefined) updateFields.avatar = avatar;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: false }
    ).select('-password');

    if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({ success: true, message: 'Profile updated', user: updatedUser });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Member Details Route
app.get('/api/groups/:groupId/members/:memberId', authenticateUser, async (req, res) => {
  try {
    const member = await User.findById(req.params.memberId).select('-password');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    // In a full implementation, you'd check if the member belongs to the group, but this suffices for the UI.
    res.status(200).json({ success: true, member });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Remove Member Route (Admin only)
app.delete('/api/groups/:groupId/members/:memberId', authenticateUser, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'Admin' && req.user.role !== 'Super Admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const channel = await Channel.findById(req.params.groupId);
    if (!channel) return res.status(404).json({ success: false, message: 'Group not found' });
    
    channel.members = channel.members.filter(mId => mId.toString() !== req.params.memberId);
    await channel.save();
    
    res.status(200).json({ success: true, message: 'Member removed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Dashboard Stats Route
app.get('/api/stats', async (req, res) => {
  try {
    const totalMembers = await User.countDocuments();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newThisWeek = await User.countDocuments({ createdAt: { $gte: oneWeekAgo } });
    const activeChannels = await Channel.countDocuments();
    const newChannelsThisWeek = await Channel.countDocuments({ createdAt: { $gte: oneWeekAgo } });
    const totalMessages = await Message.countDocuments();
    const messagesThisWeek = await Message.countDocuments({ createdAt: { $gte: oneWeekAgo } });
    const totalMeetings = await Meeting.countDocuments();
    const meetingsThisWeek = await Meeting.countDocuments({ createdAt: { $gte: oneWeekAgo } });

    // Call stats
    const totalCallsThisWeek = await Call.countDocuments({ createdAt: { $gte: oneWeekAgo } });
    const missedCallsThisWeek = await Call.countDocuments({ callStatus: 'missed', createdAt: { $gte: oneWeekAgo } });
    const endedCalls = await Call.find({ callStatus: 'ended', duration: { $gt: 0 } });
    const avgDurationSecs = endedCalls.length > 0
      ? Math.round(endedCalls.reduce((sum, c) => sum + c.duration, 0) / endedCalls.length)
      : 0;

    res.status(200).json({
      success: true,
      totalMembers,
      newThisWeek,
      activeChannels,
      newChannelsThisWeek,
      totalMessages,
      messagesThisWeek,
      totalMeetings,
      meetingsThisWeek,
      totalCallsThisWeek,
      missedCallsThisWeek,
      avgDurationSecs
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching stats.' });
  }
});

// Recent Users (for activity feed)
app.get('/api/users/recent', async (req, res) => {
  try {
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fullName role department designation createdAt');

    res.status(200).json({ success: true, users: recentUsers });
  } catch (error) {
    console.error('Recent users error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching recent users.' });
  }
});

// Get all users (for User Management table)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select('-password');
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching users.' });
  }
});

// Get all calls (for CallsView)
app.get('/api/calls', async (req, res) => {
  try {
    const calls = await Call.find()
      .populate('callerId', 'fullName email avatar')
      .populate('receiverId', 'fullName email avatar')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, calls });
  } catch (error) {
    console.error('Get calls error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching calls.' });
  }
});

// Get all channels
app.get('/api/channels', async (req, res) => {
  try {
    const channels = await Channel.find().populate('members', 'fullName email employeeCode avatar role isOnline lastSeen designation department');
    res.status(200).json({ success: true, channels });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching channels.' });
  }
});

// Create a channel
app.post('/api/channels', async (req, res) => {
  const { name, description, avatar } = req.body;
  
  if (!name) {
    return res.status(400).json({ success: false, message: 'Channel name is required.' });
  }
  
  try {
    const newChannel = new Channel({ name, description, avatar });
    await newChannel.save();
    res.status(201).json({ success: true, message: 'Channel created successfully.', channel: newChannel });
  } catch (error) {
    console.error('Create channel error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Channel name already exists.' });
    }
    res.status(500).json({ success: false, message: 'Server error creating channel.' });
  }
});

// Update a channel
app.put('/api/channels/:id', authenticateUser, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'Admin' && req.user.role !== 'Super Admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  
  const { name, description, avatar } = req.body;
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });
    
    if (name) channel.name = name;
    if (description !== undefined) channel.description = description;
    if (avatar !== undefined) channel.avatar = avatar;
    
    await channel.save();
    res.status(200).json({ success: true, message: 'Channel updated successfully', channel });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ success: false, message: 'Server error updating channel' });
  }
});

// Delete a channel (admin only)
app.delete('/api/channels/:id', authenticateUser, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'Admin' && req.user.role !== 'Super Admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const channel = await Channel.findByIdAndDelete(req.params.id);
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });
    // Also delete all messages for this channel
    await Message.deleteMany({ channelId: req.params.id });
    res.status(200).json({ success: true, message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting channel' });
  }
});

// Add a member to a channel
app.post('/api/channels/:id/members', async (req, res) => {
  const { userId } = req.body;
  const channelId = req.params.id;

  try {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    // Check if already a member
    if (channel.members.includes(userId)) {
      return res.status(400).json({ success: false, message: 'User is already a member.' });
    }

    channel.members.push(userId);
    await channel.save();

    res.status(200).json({ success: true, message: 'User added to channel successfully.' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ success: false, message: 'Server error adding member.' });
  }
});

// App listener moved to the bottom with server.listen

// Get messages for a channel
app.get('/api/channels/:id/messages', async (req, res) => {
  try {
    const messages = await Message.find({ channelId: req.params.id })
      .populate('senderId', 'fullName avatar email designation')
      .sort({ createdAt: 1 });
    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching messages.' });
  }
});

// Post a message to a channel
app.post('/api/channels/:id/messages', async (req, res) => {
  const { text, author, authorInitials, authorAvatar, senderId } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Message text is required.' });
  }
  try {
    const newMsg = new Message({
      channelId: req.params.id,
      text: text.trim(),
      author: author || 'Unknown',
      authorInitials: authorInitials || '??',
      authorAvatar: authorAvatar || '',
      senderId: senderId || null
    });
    await newMsg.save();
    
    // Optionally populate before emitting
    const populatedMsg = await Message.findById(newMsg._id).populate('senderId', 'fullName avatar email designation');
    const msgToSend = populatedMsg || newMsg;

    io.to(req.params.id).emit('receive_channel_message', msgToSend);
    res.status(201).json({ success: true, message: msgToSend });
  } catch (error) {
    console.error('Post message error:', error);
    res.status(500).json({ success: false, message: 'Server error posting message.' });
  }
});

// Get all meetings
app.get('/api/meetings', async (req, res) => {
  try {
    const meetings = await Meeting.find().sort({ scheduledAt: -1 });
    res.status(200).json({ success: true, meetings });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching meetings.' });
  }
});

// Create a meeting — generates a unique 6-char meetingId
app.post('/api/meetings', async (req, res) => {
  const { title, host, hostId, scheduledAt, duration } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: 'Meeting title is required.' });
  }
  if (!hostId) {
    return res.status(400).json({ success: false, message: 'hostId is required.' });
  }
  try {
    // Generate a unique 6-character alphanumeric meeting ID
    const generateMeetingId = () => Math.random().toString(36).substring(2, 8).toUpperCase();
    let meetingId;
    let existing;
    do {
      meetingId = generateMeetingId();
      existing = await Meeting.findOne({ meetingId });
    } while (existing);

    const newMeeting = new Meeting({ meetingId, title, host, hostId, scheduledAt, duration });
    await newMeeting.save();
    res.status(201).json({ success: true, meeting: newMeeting });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ success: false, message: 'Server error creating meeting.' });
  }
});

// Get a single meeting by meetingId (the short code, e.g. ABC123)
app.get('/api/meetings/:meetingId', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }
    res.status(200).json({ success: true, meeting });
  } catch (error) {
    console.error('Get meeting by ID error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching meeting.' });
  }
});

const cloudinary = require('cloudinary').v2;

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Multer File Upload Route
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }
  try {
    const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    res.status(200).json({ success: true, fileUrl });
  } catch (error) {
    console.error('Local upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
});

// Conversations and Direct Messages Routes
app.get('/api/conversations', async (req, res) => {
  try {
    const userId = req.query.userId;
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'fullName email avatar isOnline lastSeen')
      .populate('latestMessage');
    res.status(200).json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching conversations.' });
  }
});

app.post('/api/conversations', async (req, res) => {
  const { isGroup, name, participants } = req.body;
  try {
    if (!isGroup && participants.length === 2) {
      const existingConv = await Conversation.findOne({
        isGroup: false,
        participants: { $all: participants }
      });
      if (existingConv) {
        return res.status(200).json({ success: true, conversation: existingConv });
      }
    }
    const newConv = new Conversation({ isGroup, name, participants });
    await newConv.save();
    res.status(201).json({ success: true, conversation: newConv });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error creating conversation.' });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  try {
    await Message.deleteMany({ conversationId: req.params.id });
    await Conversation.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting conversation' });
  }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.id })
      .populate('senderId', 'fullName avatar')
      .sort({ createdAt: 1 });
    res.status(200).json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching messages.' });
  }
});

// Socket.IO Setup
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_here', (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = decoded;
    next();
  });
});

io.on('connection', async (socket) => {
  const userId = socket.user.id;
  console.log('User connected:', userId);

  // Register socket for this user
  connectedUsers[userId] = socket.id;

  // Set user online
  await User.findByIdAndUpdate(userId, { isOnline: true });
  io.emit('user_online', userId);

  // ─── Chat Events ───────────────────────────────────────────
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
  });

  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('typing', { userId, roomId: data.roomId });
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.roomId).emit('stop_typing', { userId, roomId: data.roomId });
  });

  socket.on('send_message', async (data) => {
    try {
      const newMsg = new Message({
        conversationId: data.roomId,
        senderId: userId,
        text: data.text,
        fileUrl: data.fileUrl,
        messageStatus: 'sent'
      });
      await newMsg.save();
      const populatedMsg = await Message.findById(newMsg._id).populate('senderId', 'fullName avatar');
      await Conversation.findByIdAndUpdate(data.roomId, { latestMessage: newMsg._id });
      io.to(data.roomId).emit('receive_message', populatedMsg);
    } catch (err) {
      console.error('Error sending message via socket:', err);
    }
  });

  socket.on('message_seen', async (data) => {
    try {
      await Message.updateMany(
        { conversationId: data.roomId, senderId: { $ne: userId }, messageStatus: { $ne: 'seen' } },
        { messageStatus: 'seen' }
      );
      io.to(data.roomId).emit('message_seen', { roomId: data.roomId, userId });
    } catch (err) {
      console.error(err);
    }
  });

  // ─── WebRTC Calling Signaling ──────────────────────────────

  // Caller initiates a call
  socket.on('call_user', async ({ to, callType, callerInfo }, callback) => {
    const receiverSocketId = connectedUsers[to];
    // Save call record as 'missed' initially (will be updated on accept/reject)
    const call = new Call({
      callerId: userId,
      receiverId: to,
      callType,
      callStatus: 'missed',
      startTime: new Date()
    });
    await call.save();
    socket.callId = call._id.toString();
    
    if (callback && typeof callback === 'function') {
      callback({ callId: call._id.toString() });
    }

    if (receiverSocketId) {
      io.to(receiverSocketId).emit('incoming_call', {
        from: userId,
        callType,
        callerInfo,
        callId: call._id
      });
    } else {
      // Receiver offline — immediately mark as missed
      socket.emit('call_ended', { reason: 'User is offline' });
    }
  });

  // Receiver accepts the call
  socket.on('accept_call', async ({ to, callId }) => {
    const callerSocketId = connectedUsers[to];
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_accepted', { from: userId });
    }
    // Update call status
    if (callId) {
      await Call.findByIdAndUpdate(callId, { callStatus: 'ongoing', startTime: new Date() });
    }
  });

  // Receiver rejects the call
  socket.on('reject_call', async ({ to, callId }) => {
    const callerSocketId = connectedUsers[to];
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_rejected', { from: userId });
    }
    if (callId) {
      await Call.findByIdAndUpdate(callId, { callStatus: 'rejected' });
    }
  });

  // Relay WebRTC SDP offer
  socket.on('offer', ({ to, offer }) => {
    const receiverSocketId = connectedUsers[to];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('offer', { from: userId, offer });
    }
  });

  // Relay WebRTC SDP answer
  socket.on('answer', ({ to, answer }) => {
    const callerSocketId = connectedUsers[to];
    if (callerSocketId) {
      io.to(callerSocketId).emit('answer', { from: userId, answer });
    }
  });

  // Relay ICE candidates
  socket.on('ice_candidate', ({ to, candidate }) => {
    const targetSocketId = connectedUsers[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice_candidate', { from: userId, candidate });
    }
  });

  // End call
  socket.on('end_call', async ({ to, callId, duration }) => {
    const targetSocketId = connectedUsers[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_ended', { from: userId, reason: 'ended' });
    }
    if (callId) {
      await Call.findByIdAndUpdate(callId, {
        callStatus: 'ended',
        endTime: new Date(),
        duration: duration || 0
      });
    }
  });

  // ─── Disconnect ────────────────────────────────────────────
  socket.on('disconnect', async () => {
    console.log('User disconnected:', userId);
    delete connectedUsers[userId];
    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
    io.emit('user_offline', { userId, lastSeen: new Date() });

    // Auto-clean from any meeting room
    for (const [roomId, participants] of meetingRooms.entries()) {
      const found = [...participants].find(p => p.socketId === socket.id);
      if (found) {
        participants.delete(found);
        if (participants.size === 0) {
          meetingRooms.delete(roomId);
        } else {
          socket.to(roomId).emit('meeting:user-left', { socketId: socket.id });
        }
        break;
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  MEETING ROOM — WebRTC Signaling (room-based, multi-peer)
//  Each socket.io room is named "meeting:<meetingId>"
//  e.g. "meeting:ABC123" — so all participants share ONE room.
// ═══════════════════════════════════════════════════════════════

// meetingId → Set of { socketId, userId, userName, isMuted, isCameraOff, isAdmin }
const meetingRooms = new Map();
// meetingId → Set of { socketId, userId, userName }
const waitingRooms = new Map();

// Separate namespace so it doesn't interfere with the main auth middleware
const meetingNS = io.of('/meeting');

meetingNS.on('connection', (socket) => {
  let currentMeetingId = null;  // The short code like "ABC123"
  let currentUserId   = null;
  let currentUserName = 'Guest';

  const roomKey    = (id) => `meeting:${id}`;
  const waitingKey = (id) => `meeting:${id}:waiting`;

  // ── Request to join (for normal participants) ────────────────
  socket.on('meeting:request-join', ({ meetingId, userId, userName }) => {
    currentMeetingId = meetingId;
    currentUserId    = userId;
    currentUserName  = userName || 'Guest';

    // Sit in the waiting room — separate from the live signaling room
    socket.join(waitingKey(meetingId));

    if (!waitingRooms.has(meetingId)) waitingRooms.set(meetingId, new Set());
    waitingRooms.get(meetingId).add({ socketId: socket.id, userId, userName: currentUserName });

    // Notify all hosts who are already in the live room
    meetingNS.to(roomKey(meetingId)).emit('meeting:join-request', {
      socketId: socket.id,
      userId,
      userName: currentUserName,
    });

    console.log(`[Meeting] ${currentUserName} requested to join ${meetingId}`);
  });

  // ── Accept user (host only) ───────────────────────────────────
  socket.on('meeting:accept-user', ({ targetSocketId, meetingId }) => {
    meetingNS.to(targetSocketId).emit('meeting:request-accepted');

    const waiting = waitingRooms.get(meetingId);
    if (waiting) {
      for (const p of [...waiting]) {
        if (p.socketId === targetSocketId) { waiting.delete(p); break; }
      }
    }
  });

  // ── Reject user (host only) ───────────────────────────────────
  socket.on('meeting:reject-user', ({ targetSocketId, meetingId }) => {
    meetingNS.to(targetSocketId).emit('meeting:request-rejected');

    const waiting = waitingRooms.get(meetingId);
    if (waiting) {
      for (const p of [...waiting]) {
        if (p.socketId === targetSocketId) { waiting.delete(p); break; }
      }
    }
  });

  // ── Join live room (host immediately; member after accept) ────
  socket.on('meeting:join', ({ meetingId, userId, userName, isAdmin }) => {
    currentMeetingId = meetingId;
    currentUserId    = userId;
    currentUserName  = userName || 'Guest';
    const key        = roomKey(meetingId);

    // Leave waiting room if the user was sitting there
    socket.leave(waitingKey(meetingId));

    socket.join(key);

    if (!meetingRooms.has(meetingId)) meetingRooms.set(meetingId, new Set());
    const room = meetingRooms.get(meetingId);

    // Send existing live participants to the joiner
    const existing = [...room].map(p => ({
      socketId:    p.socketId,
      userId:      p.userId,
      userName:    p.userName,
      isMuted:     p.isMuted,
      isCameraOff: p.isCameraOff,
      isAdmin:     p.isAdmin,
    }));
    socket.emit('meeting:existing-participants', existing);

    // Send pending waitlist to host so they can see queued requests
    if (isAdmin) {
      const waiting = waitingRooms.get(meetingId);
      if (waiting && waiting.size > 0) {
        socket.emit('meeting:existing-requests', [...waiting]);
      }
    }

    // Broadcast to everyone already in the live room
    socket.to(key).emit('meeting:user-joined', {
      socketId:    socket.id,
      userId,
      userName:    currentUserName,
      isMuted:     false,
      isCameraOff: false,
      isAdmin,
    });

    // Register participant
    room.add({ socketId: socket.id, userId, userName: currentUserName, isMuted: false, isCameraOff: false, isAdmin });

    console.log(`[Meeting] ${currentUserName} joined room ${meetingId} (${key}). Total: ${room.size}`);
  });

  // ── WebRTC offer ─────────────────────────────────────────────
  socket.on('meeting:offer', ({ targetSocketId, offer }) => {
    meetingNS.to(targetSocketId).emit('meeting:offer', {
      fromSocketId: socket.id,
      fromUserName: currentUserName,
      offer,
    });
  });

  // ── WebRTC answer ────────────────────────────────────────────
  socket.on('meeting:answer', ({ targetSocketId, answer }) => {
    meetingNS.to(targetSocketId).emit('meeting:answer', {
      fromSocketId: socket.id,
      answer,
    });
  });

  // ── ICE candidate ────────────────────────────────────────────
  socket.on('meeting:ice-candidate', ({ targetSocketId, candidate }) => {
    meetingNS.to(targetSocketId).emit('meeting:ice-candidate', {
      fromSocketId: socket.id,
      candidate,
    });
  });

  // ── Mute toggle ──────────────────────────────────────────────
  socket.on('meeting:mute-toggle', ({ isMuted }) => {
    if (!currentMeetingId) return;
    const room = meetingRooms.get(currentMeetingId);
    if (room) for (const p of room) if (p.socketId === socket.id) { p.isMuted = isMuted; break; }
    socket.to(roomKey(currentMeetingId)).emit('meeting:mute-toggle', { socketId: socket.id, isMuted });
  });

  // ── Camera toggle ────────────────────────────────────────────
  socket.on('meeting:cam-toggle', ({ isCameraOff }) => {
    if (!currentMeetingId) return;
    const room = meetingRooms.get(currentMeetingId);
    if (room) for (const p of room) if (p.socketId === socket.id) { p.isCameraOff = isCameraOff; break; }
    socket.to(roomKey(currentMeetingId)).emit('meeting:cam-toggle', { socketId: socket.id, isCameraOff });
  });

  // ── Chat message ─────────────────────────────────────────────
  socket.on('meeting:chat-message', ({ text }) => {
    if (!currentMeetingId || !text?.trim()) return;
    const msg = {
      id:       Date.now(),
      socketId: socket.id,
      userId:   currentUserId,
      userName: currentUserName,
      text:     text.trim(),
      time:     new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    meetingNS.to(roomKey(currentMeetingId)).emit('meeting:chat-message', msg);
  });

  // ── Raise hand ───────────────────────────────────────────────
  socket.on('meeting:raise-hand', () => {
    if (!currentMeetingId) return;
    meetingNS.to(roomKey(currentMeetingId)).emit('meeting:raise-hand', {
      socketId: socket.id,
      userName: currentUserName,
    });
  });

  // ── Kick user ────────────────────────────────────────────────
  socket.on('meeting:kick-user', ({ targetSocketId }) => {
    if (!currentMeetingId) return;
    meetingNS.to(targetSocketId).emit('meeting:kicked');
    meetingNS.to(roomKey(currentMeetingId)).emit('meeting:peer-left', { socketId: targetSocketId });
    const targetSocket = meetingNS.sockets.get(targetSocketId);
    if (targetSocket) targetSocket.leave(roomKey(currentMeetingId));
  });

  // ── Screen share ─────────────────────────────────────────────
  socket.on('meeting:screen-share', ({ isSharing }) => {
    if (!currentMeetingId) return;
    socket.to(roomKey(currentMeetingId)).emit('meeting:screen-share', { socketId: socket.id, isSharing });
  });

  // ── Leave ────────────────────────────────────────────────────
  socket.on('meeting:leave', () => handleLeave());
  socket.on('disconnect',    () => handleLeave());

  function handleLeave() {
    if (!currentMeetingId) return;
    const key = roomKey(currentMeetingId);

    socket.leave(key);
    socket.leave(waitingKey(currentMeetingId));

    // Remove from live room
    const room = meetingRooms.get(currentMeetingId);
    if (room) {
      for (const p of [...room]) if (p.socketId === socket.id) { room.delete(p); break; }
      if (room.size === 0) meetingRooms.delete(currentMeetingId);
    }

    // Remove from waiting room (if they left while pending)
    const waiting = waitingRooms.get(currentMeetingId);
    if (waiting) {
      for (const p of [...waiting]) {
        if (p.socketId === socket.id) {
          waiting.delete(p);
          meetingNS.to(key).emit('meeting:request-cancelled', { socketId: socket.id });
          break;
        }
      }
      if (waiting.size === 0) waitingRooms.delete(currentMeetingId);
    }

    socket.to(key).emit('meeting:user-left', { socketId: socket.id });
    console.log(`[Meeting] ${currentUserName} left ${currentMeetingId}`);
    currentMeetingId = null;
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
