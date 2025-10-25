
const ChatMessage = require('../models/ChatMessage');
const ChatRoom = require('../models/ChatRoom');
const jwt = require('jsonwebtoken');

const connectedUsers = new Map(); // userId -> socketId mapping
const userSockets = new Map(); // socketId -> user info mapping

const handleSocketConnection = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    // Handle user joining
    socket.on('join_user', async (userId) => {
      try {
        console.log('👤 User joining:', userId, 'Socket:', socket.id);
        
        // Store user connection
        connectedUsers.set(userId, socket.id);
        userSockets.set(socket.id, { userId });
        
        // Join user to their personal room
        socket.join(`user_${userId}`);
        
        // Broadcast user online status
        socket.broadcast.emit('user_online', { userId });
        
        console.log('✅ User joined successfully:', userId);
      } catch (error) {
        console.error('❌ Error joining user:', error);
      }
    });

    // Handle joining chat rooms
    socket.on('join_room', async ({ roomId, userId }) => {
      try {
        console.log('🏠 Joining room:', roomId, 'User:', userId);
        socket.join(roomId);
        console.log('✅ Joined room successfully:', roomId);
      } catch (error) {
        console.error('❌ Error joining room:', error);
      }
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        console.log('📤 Sending message:', data);
        
        const { senderId, receiverId, content, type = 'text' } = data;
        
        // Create room ID
        const roomId = [senderId, receiverId].sort().join('-');
        
        // Create or update chat room
        let chatRoom = await ChatRoom.findOne({
          participants: { $all: [senderId, receiverId] }
        }).populate('participants', 'name email role');
        
        if (!chatRoom) {
          chatRoom = new ChatRoom({
            participants: [senderId, receiverId],
            unreadCount: new Map()
          });
        }
        
        // Create new message
        const message = new ChatMessage({
          senderId,
          receiverId,
          content,
          type,
          roomId,
          isRead: false
        });
        
        await message.save();
        
        // Update room's last message and activity
        chatRoom.lastMessage = message._id;
        chatRoom.lastActivity = new Date();
        
        // Update unread count for receiver
        const currentUnread = chatRoom.unreadCount.get(receiverId) || 0;
        chatRoom.unreadCount.set(receiverId, currentUnread + 1);
        
        await chatRoom.save();
        
        // Populate message with user details
        await message.populate([
          { path: 'senderId', select: 'name email role' },
          { path: 'receiverId', select: 'name email role' }
        ]);
        
        console.log('✅ Message saved:', message._id);
        
        // Emit to both users
        const senderSocketId = connectedUsers.get(senderId);
        const receiverSocketId = connectedUsers.get(receiverId);
        
        // Emit new message to both participants
        io.to(roomId).emit('new_message', {
          message,
          roomId
        });
        
        // Send notification to receiver if they're online
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message_notification', {
            message,
            senderName: message.senderId.name,
            roomId
          });
        }
        
        console.log('📨 Message broadcasted to room:', roomId);
        
      } catch (error) {
        console.error('❌ Error sending message:', error);
        socket.emit('message_error', { error: error.message });
      }
    });

    // Handle message read status
    socket.on('mark_read', async ({ messageId, userId }) => {
      try {
        const message = await ChatMessage.findById(messageId);
        if (message && message.receiverId.toString() === userId) {
          message.isRead = true;
          await message.save();
          
          // Update unread count in room
          const roomId = message.roomId;
          const chatRoom = await ChatRoom.findOne({
            participants: { $all: [message.senderId, message.receiverId] }
          });
          
          if (chatRoom) {
            const currentUnread = Math.max(0, (chatRoom.unreadCount.get(userId) || 1) - 1);
            chatRoom.unreadCount.set(userId, currentUnread);
            await chatRoom.save();
          }
          
          io.to(roomId).emit('message_read', { messageId });
        }
      } catch (error) {
        console.error('❌ Error marking message as read:', error);
      }
    });

    // Handle call initiation
    socket.on('initiate_call', ({ callerId, receiverId, callType }) => {
      console.log('📞 Call initiated:', { callerId, receiverId, callType });
      
      const receiverSocketId = connectedUsers.get(receiverId);
      const callerSocketId = connectedUsers.get(callerId);
      
      if (receiverSocketId) {
        // Send call notification to receiver
        io.to(receiverSocketId).emit('incoming_call', {
          callerId,
          receiverId,
          callType,
          callerSocketId,
          receiverSocketId
        });
        
        console.log('📞 Call notification sent to receiver');
      } else {
        // Receiver is offline
        io.to(callerSocketId).emit('call_failed', {
          reason: 'User is offline'
        });
      }
    });

    // Handle call response (accept/decline)
    socket.on('call_response', ({ targetSocketId, accepted, callData }) => {
      console.log('📞 Call response:', { targetSocketId, accepted });
      
      if (accepted) {
        // Both users accept the call
        io.to(targetSocketId).emit('call_accepted', callData);
        socket.emit('call_accepted', callData);
      } else {
        // Call declined
        io.to(targetSocketId).emit('call_declined');
      }
    });

    // Handle call signals for WebRTC
    socket.on('call_signal', ({ targetSocketId, signal }) => {
      io.to(targetSocketId).emit('call_signal', {
        signal,
        socketId: socket.id
      });
    });

    // Handle call end
    socket.on('end_call', ({ targetSocketId }) => {
      io.to(targetSocketId).emit('call_ended');
      socket.emit('call_ended');
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('🔌 User disconnected:', socket.id);
      
      const userInfo = userSockets.get(socket.id);
      if (userInfo) {
        const { userId } = userInfo;
        
        // Remove from connected users
        connectedUsers.delete(userId);
        userSockets.delete(socket.id);
        
        // Broadcast user offline status
        socket.broadcast.emit('user_offline', { userId });
        
        console.log('👤 User went offline:', userId);
      }
    });
  });
};

module.exports = { handleSocketConnection };
