
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const { handleSocketConnection } = require('./socket/socketHandlers');


// Import routes
const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const specialtyRoutes = require('./routes/specialties');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const courseRoutes = require('./routes/courses');
const blogRoutes = require('./routes/blogs');
const activityRoutes = require('./routes/activities');
const testimonialRoutes = require('./routes/testimonials');
const chatRoutes = require('./routes/chat');
const agoraRoutes = require('./routes/agora');
const adminRoutes = require('./routes/admin');

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
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8,
  transports: ['websocket', 'polling']
});

// Make io available to routes (e.g. chat, emergency)
app.set('io', io);

// Initialize socket handlers (this replaces the duplicate handler below)
handleSocketConnection(io);

// Connection error debugging
io.engine.on("connection_error", (err) => {
  console.log("❌ Socket connection error details:");
  console.log("Error code:", err.code);
  console.log("Error message:", err.message);
  console.log("Error context:", err.context);
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/specialties', specialtyRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/categories', require('./routes/categories'));
app.use('/api/chat', chatRoutes);
app.use('/api/agora', agoraRoutes);
app.use('/api/admin', adminRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running successfully!' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
