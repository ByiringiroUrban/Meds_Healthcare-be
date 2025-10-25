
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const { handleSocketConnection } = require('./socket/socketHandlers');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize socket handlers
handleSocketConnection(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/specialties', require('./routes/specialties'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/blogs', require('./routes/blogs'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/chat', require('./routes/chat'));

// Debug: Log all registered routes
console.log('🔍 Chat routes registered at /api/chat');
console.log('📋 Available chat endpoints:');
console.log('  GET  /api/chat/rooms');
console.log('  POST /api/chat/rooms/create');
console.log('  GET  /api/chat/messages/:roomId');
console.log('  POST /api/chat/messages');
console.log('  PUT  /api/chat/messages/:id');
console.log('  DELETE /api/chat/messages/:id');
console.log('  POST /api/chat/messages/:id/read');

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
