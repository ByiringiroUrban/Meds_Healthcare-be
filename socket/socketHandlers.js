
const ChatMessage = require('../models/ChatMessage');
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Emergency = require('../models/Emergency');
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
    socket.on('initiate_call', async ({ callerId, receiverId, callType, channelName, callerName }) => {
      console.log('📞 Call initiated:', { callerId, receiverId, callType, channelName, callerName });
      
      const receiverSocketId = connectedUsers.get(receiverId);
      const callerSocketId = connectedUsers.get(callerId);
      
      if (receiverSocketId) {
        // Fetch caller info from database if not provided
        let finalCallerName = callerName;
        if (!finalCallerName) {
          try {
            const caller = await User.findById(callerId).select('name email role');
            if (caller) {
              finalCallerName = caller.name;
              // If caller is a doctor, try to get name from Doctor model
              if (caller.role === 'doctor') {
                const doctor = await Doctor.findOne({ email: caller.email.toLowerCase().trim() });
                if (doctor) {
                  finalCallerName = doctor.name;
                }
              }
            }
          } catch (error) {
            console.error('Error fetching caller info:', error);
            finalCallerName = 'Unknown';
          }
        }
        
        // Generate channel name if not provided
        let finalChannelName = channelName;
        if (!finalChannelName) {
          const sorted = [callerId, receiverId].sort();
          finalChannelName = `call_${sorted[0]}_${sorted[1]}`;
        }
        
        // Send call notification to receiver with all necessary info
        io.to(receiverSocketId).emit('incoming_call', {
          callerId,
          receiverId,
          callType,
          channelName: finalChannelName,
          callerName: finalCallerName,
          callerSocketId,
          receiverSocketId
        });
        
        console.log('📞 Call notification sent to receiver:', {
          receiverId,
          callerName: finalCallerName,
          channelName: finalChannelName,
          callType
        });
      } else {
        // Receiver is offline
        console.log('❌ Receiver is offline:', receiverId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call_failed', {
            reason: 'User is offline'
          });
        }
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

    // Handle emergency alert creation
    socket.on('create_emergency', async (data) => {
      try {
        console.log('🚨 Emergency alert received via socket:', data);
        
        // This is handled by the REST API, but we can emit notifications here
        // The actual creation happens in the POST /api/emergency route
        socket.broadcast.emit('emergency_alert', data);
      } catch (error) {
        console.error('❌ Error handling emergency alert:', error);
      }
    });

    // Handle joining emergency monitoring rooms (for admins/doctors)
    socket.on('join_emergency_monitoring', async (userId) => {
      try {
        const user = await User.findById(userId);
        if (user && (user.role === 'admin' || user.role === 'doctor')) {
          socket.join('admins');
          socket.join('doctors');
          console.log('✅ User joined emergency monitoring:', userId);
        }
      } catch (error) {
        console.error('❌ Error joining emergency monitoring:', error);
      }
    });

    // Handle emergency status updates
    socket.on('emergency_status_update', async (data) => {
      try {
        const { emergencyId, status, userId } = data;
        
        const emergency = await Emergency.findById(emergencyId);
        if (emergency) {
          // Emit to patient
          const patientSocketId = connectedUsers.get(emergency.patientId.toString());
          if (patientSocketId) {
            io.to(patientSocketId).emit('emergency_status_changed', {
              emergencyId,
              status,
              message: `Emergency status updated to ${status}`
            });
          }
          
          // Emit to all admins and doctors
          io.to('admins').emit('emergency_updated', { emergencyId, status });
          io.to('doctors').emit('emergency_updated', { emergencyId, status });
        }
      } catch (error) {
        console.error('❌ Error updating emergency status:', error);
      }
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
