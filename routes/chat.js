const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const { authenticate } = require('../middleware/auth');

// Helper function to generate room ID
const generateRoomId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('-');
};

// Debug test route
router.get('/test', (req, res) => {
  res.json({ message: 'Chat routes are working!', timestamp: new Date().toISOString() });
});

// GET /api/chat/rooms - Get user's chat rooms
router.get('/rooms', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const rooms = await ChatRoom.find({
      participants: userId
    })
    .populate('participants', 'name email role')
    .populate('lastMessage')
    .sort({ lastActivity: -1 });

    res.json(rooms);
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    res.status(500).json({ error: 'Failed to fetch chat rooms' });
  }
});

// GET /api/chat/messages/:roomId - Get messages for a room
router.get('/messages/:roomId', authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    
    // Verify user is participant in this room
    const room = await ChatRoom.findOne({
      _id: roomId,
      participants: userId
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

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    const roomId = generateRoomId(senderId, receiverId);

    // Create or update chat room
    let room = await ChatRoom.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    if (!room) {
      room = new ChatRoom({
        participants: [senderId, receiverId],
        lastActivity: new Date(),
        unreadCount: new Map()
      });
    }

    // Create message
    const message = new ChatMessage({
      senderId,
      receiverId,
      content: content.trim(),
      type,
      roomId: room._id
    });

    await message.save();

    // Update room with last message and activity
    room.lastMessage = message._id;
    room.lastActivity = new Date();
    
    // Update unread count for receiver
    const currentUnread = room.unreadCount.get(receiverId.toString()) || 0;
    room.unreadCount.set(receiverId.toString(), currentUnread + 1);
    
    await room.save();

    // Populate the message for response
    await message.populate('senderId', 'name email role');
    await message.populate('receiverId', 'name email role');

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
    if (!participant) {
      participant = await Doctor.findById(participantId);
    }
    if (!participant) {
      console.log('❌ Participant not found in User or Doctor collections:', participantId);
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    console.log('✅ Participant found:', participant.name, 'Type:', participant.role || 'Doctor');

    // Find existing room or create new one
    let room = await ChatRoom.findOne({
      participants: { $all: [userId, participantId] }
    }).populate('participants', 'name email role');

    if (!room) {
      room = new ChatRoom({
        participants: [userId, participantId],
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
    const userId = req.user.id;

    const message = await ChatMessage.findOne({
      _id: id,
      receiverId: userId
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.isRead = true;
    await message.save();

    // Update room unread count
    const room = await ChatRoom.findById(message.roomId);
    if (room) {
      const currentUnread = room.unreadCount.get(userId.toString()) || 0;
      room.unreadCount.set(userId.toString(), Math.max(0, currentUnread - 1));
      await room.save();
    }

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

console.log('📊 Chat routes module loaded successfully');
module.exports = router;