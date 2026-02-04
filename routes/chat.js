const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ChatMessage = require('../models/ChatMessage');
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const { authenticate } = require('../middleware/auth');

// Multer for chat voice uploads
const voiceStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/chat-voice';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, 'voice-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
  }
});
const uploadVoice = multer({
  storage: voiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Helper function to generate room ID
const generateRoomId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('-');
};

/**
 * Get all participant IDs for the current user (for doctors: User._id and Doctor._id)
 */
async function getParticipantIdsForUser(reqUser) {
  const ids = [(reqUser.id || reqUser._id).toString()];
  if (reqUser.role === 'doctor' && reqUser.email) {
    const doctorByEmail = await Doctor.findOne({ email: reqUser.email.toLowerCase().trim() }).select('_id').lean();
    if (doctorByEmail && !ids.includes(doctorByEmail._id.toString())) {
      ids.push(doctorByEmail._id.toString());
    }
  }
  return ids;
}

// Debug test route
router.get('/test', (req, res) => {
  res.json({ message: 'Chat routes are working!', timestamp: new Date().toISOString() });
});

// POST /api/chat/upload-voice - Upload voice message file
router.post('/upload-voice', authenticate, uploadVoice.single('voice'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No voice file uploaded' });
    }
    const url = `/uploads/chat-voice/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    console.error('Error uploading voice:', error);
    res.status(500).json({ error: 'Failed to upload voice message' });
  }
});

// GET /api/chat/rooms - Get user's chat rooms (doctors see rooms where they're in as User or Doctor)
router.get('/rooms', authenticate, async (req, res) => {
  try {
    const participantIds = await getParticipantIdsForUser(req.user);
    const rooms = await ChatRoom.find({
      participants: { $in: participantIds }
    })
    .populate('participants', 'name email role')
    .populate('lastMessage')
    .sort({ lastActivity: -1 });

    // Add myUnreadCount per room so frontend badge is correct (sum over all of current user's ids)
    const roomsWithUnread = rooms.map((room) => {
      const r = room.toObject ? room.toObject() : room;
      let myUnread = 0;
      const u = r.unreadCount;
      if (u) {
        participantIds.forEach((pid) => {
          const key = pid.toString();
          const n = u instanceof Map ? u.get(key) : (u[key] ?? 0);
          myUnread += Number(n) || 0;
        });
      }
      r.myUnreadCount = myUnread;
      return r;
    });

    res.json(roomsWithUnread);
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    res.status(500).json({ error: 'Failed to fetch chat rooms' });
  }
});

// GET /api/chat/messages/:roomId - Get messages for a room
router.get('/messages/:roomId', authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;
    const participantIds = await getParticipantIdsForUser(req.user);
    
    // Verify user is participant in this room (match User or Doctor id)
    const room = await ChatRoom.findOne({
      _id: roomId,
      participants: { $in: participantIds }
    });
    
    if (!room) {
      return res.status(403).json({ error: 'Access denied to this chat room' });
    }

    const messages = await ChatMessage.find({ roomId })
      .populate('senderId', 'name email role')
      .populate('receiverId', 'name email role')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/chat/messages - Send a message
router.post('/messages', authenticate, async (req, res) => {
  try {
    const { receiverId, content, type = 'text' } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !content) {
      return res.status(400).json({ error: 'Receiver ID and content are required' });
    }

    // Verify receiver exists (check both User and Doctor collections)
    let receiver = await User.findById(receiverId);
    let receiverIdForMessage = receiverId;
    if (!receiver) {
      receiver = await Doctor.findById(receiverId);
      if (receiver) {
        // Prefer User._id for doctors so refs work; use Doctor._id only if no User
        const userWithSameEmail = await User.findOne({ email: receiver.email.toLowerCase().trim(), role: 'doctor' }).select('_id').lean();
        if (userWithSameEmail) {
          receiverIdForMessage = userWithSameEmail._id.toString();
        }
      }
    }
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    const roomId = generateRoomId(senderId, receiverIdForMessage);

    // Create or update chat room (use resolved ids for consistency)
    let room = await ChatRoom.findOne({
      participants: { $all: [senderId, receiverIdForMessage] }
    });

    if (!room) {
      room = new ChatRoom({
        participants: [senderId, receiverIdForMessage],
        lastActivity: new Date(),
        unreadCount: new Map()
      });
    }

    // Create message
    const message = new ChatMessage({
      senderId,
      receiverId: receiverIdForMessage,
      content: content.trim(),
      type,
      roomId: room._id
    });

    await message.save();

    // Update room with last message and activity
    room.lastMessage = message._id;
    room.lastActivity = new Date();
    
    // Update unread count for receiver
    const currentUnread = room.unreadCount.get(receiverIdForMessage.toString()) || 0;
    room.unreadCount.set(receiverIdForMessage.toString(), currentUnread + 1);
    
    await room.save();

    // Populate the message for response
    await message.populate('senderId', 'name email role');
    await message.populate('receiverId', 'name email role');

    // Emit real-time notification to receiver so message icon badge updates
    // For doctors, emit to BOTH user_<User_id> and user_<Doctor_id> so they get it regardless of which id they connected with
    const io = req.app.get('io');
    if (io) {
      const receiverSocketRoomIds = [receiverIdForMessage.toString()];
      if (receiver._id.toString() !== receiverIdForMessage.toString()) {
        receiverSocketRoomIds.push(receiver._id.toString());
      }
      if (receiver.role === 'doctor' && receiver.email) {
        const doctorByEmail = await Doctor.findOne({ email: receiver.email.toLowerCase().trim() }).select('_id').lean();
        if (doctorByEmail && !receiverSocketRoomIds.includes(doctorByEmail._id.toString())) {
          receiverSocketRoomIds.push(doctorByEmail._id.toString());
        }
      }
      const senderRoom = `user_${senderId}`;
      const messagePayload = message.toObject ? message.toObject() : message;
      const payload = { message: messagePayload, senderName: message.senderId?.name || 'Someone', roomId: room._id.toString() };
      const newMessagePayload = { message: messagePayload, roomId: room._id.toString() };
      receiverSocketRoomIds.forEach((id) => {
        const roomName = `user_${id}`;
        io.to(roomName).emit('message_notification', payload);
        io.to(roomName).emit('new_message', newMessagePayload);
      });
      io.to(senderRoom).emit('new_message', newMessagePayload);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/chat/messages/:id - Edit a message
router.put('/messages/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const message = await ChatMessage.findOne({
      _id: id,
      senderId: userId
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();
    await message.populate('senderId', 'name email role');
    await message.populate('receiverId', 'name email role');

    res.json(message);
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// DELETE /api/chat/messages/:id - Delete a message
router.delete('/messages/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const message = await ChatMessage.findOne({
      _id: id,
      senderId: userId
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }

    await ChatMessage.findByIdAndDelete(id);
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// POST /api/chat/rooms/create - Create or get existing room
router.post('/rooms/create', authenticate, async (req, res) => {
  try {
    console.log('🔄 Chat room creation request received');
    console.log('📝 Request body:', req.body);
    console.log('👤 User ID:', req.user?.id);
    console.log('📝 Headers:', req.headers);
    console.log('🔑 Auth header:', req.header('Authorization'));
    
    const { participantId } = req.body;
    const userId = req.user.id;

    if (!participantId) {
      return res.status(400).json({ error: 'Participant ID is required' });
    }

    // Verify participant exists (check both User and Doctor collections)
    let participant = await User.findById(participantId);
    let participantIdForRoom = participantId;
    if (!participant) {
      participant = await Doctor.findById(participantId);
      if (participant) {
        // Prefer User._id for doctors so populate works; use Doctor._id only if no User
        const userWithSameEmail = await User.findOne({ email: participant.email.toLowerCase().trim(), role: 'doctor' }).select('_id').lean();
        if (userWithSameEmail) {
          participantIdForRoom = userWithSameEmail._id.toString();
        }
      }
    }
    if (!participant) {
      console.log('❌ Participant not found in User or Doctor collections:', participantId);
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    console.log('✅ Participant found:', participant.name, 'Type:', participant.role || 'Doctor');

    // Find existing room or create new one (use participantIdForRoom for consistent User ref)
    let room = await ChatRoom.findOne({
      participants: { $all: [userId, participantIdForRoom] }
    }).populate('participants', 'name email role');

    if (!room) {
      room = new ChatRoom({
        participants: [userId, participantIdForRoom],
        lastActivity: new Date(),
        unreadCount: new Map()
      });
      await room.save();
      await room.populate('participants', 'name email role');
    }

    console.log('✅ Room created/found successfully:', room._id);
    res.json(room);
  } catch (error) {
    console.error('❌ Error creating/getting room:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create/get room',
      details: error.message 
    });
  }
});

// POST /api/chat/messages/:id/read - Mark message as read
router.post('/messages/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const participantIds = await getParticipantIdsForUser(req.user);

    const message = await ChatMessage.findOne({
      _id: id,
      receiverId: { $in: participantIds }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.isRead = true;
    await message.save();

    // Decrement room unread count for the key that belongs to current user (so badge disappears when conversation is read)
    const room = await ChatRoom.findById(message.roomId);
    if (room && room.unreadCount) {
      for (const pid of participantIds) {
        const key = pid.toString();
        const currentUnread = room.unreadCount.get(key) || 0;
        if (currentUnread > 0) {
          room.unreadCount.set(key, Math.max(0, currentUnread - 1));
          await room.save();
          break;
        }
      }
    }

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

console.log('📊 Chat routes module loaded successfully');
module.exports = router;