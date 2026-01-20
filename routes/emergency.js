const express = require('express');
const router = express.Router();
const Emergency = require('../models/Emergency');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for voice message uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/emergency-voice';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'voice-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for voice messages
  },
  fileFilter: function (req, file, cb) {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// POST /api/emergency - Create a new emergency alert
router.post('/', authenticate, upload.single('voiceMessage'), async (req, res) => {
  try {
    const patientId = req.user.id;
    const { 
      latitude, 
      longitude, 
      address, 
      accuracy,
      symptoms, 
      notes,
      voiceDuration 
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Location (latitude and longitude) is required' 
      });
    }

    // Parse symptoms if it's a string
    let symptomsArray = [];
    if (symptoms) {
      symptomsArray = Array.isArray(symptoms) ? symptoms : JSON.parse(symptoms);
    }

    // Determine priority based on symptoms
    const criticalSymptoms = [
      'Chest Pain',
      'Difficulty Breathing',
      'Unconscious',
      'Heart Attack',
      'Stroke'
    ];
    const priority = symptomsArray.some(s => criticalSymptoms.includes(s)) 
      ? 'critical' 
      : 'high';

    // Create emergency alert
    const emergency = new Emergency({
      patientId,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || 'Location not available',
        accuracy: accuracy ? parseFloat(accuracy) : undefined
      },
      symptoms: symptomsArray,
      notes: notes || '',
      priority,
      voiceMessage: req.file ? {
        url: `/uploads/emergency-voice/${req.file.filename}`,
        duration: voiceDuration ? parseFloat(voiceDuration) : undefined
      } : undefined
    });

    await emergency.save();

    // Populate patient information
    await emergency.populate('patientId', 'name email phone avatar');

    // Emit real-time notification to all admins and doctors
    const io = req.app.get('io');
    if (io) {
      io.emit('new_emergency', {
        emergency: emergency.toObject(),
        message: 'New emergency alert received'
      });

      // Also notify specific admin/doctor rooms
      io.to('admins').emit('emergency_alert', emergency.toObject());
      io.to('doctors').emit('emergency_alert', emergency.toObject());
    }

    console.log('🚨 Emergency alert created:', emergency._id);

    res.status(201).json({
      success: true,
      message: 'Emergency alert sent successfully! Help is on the way.',
      emergency
    });
  } catch (error) {
    console.error('Error creating emergency alert:', error);
    res.status(500).json({ 
      error: 'Failed to create emergency alert',
      details: error.message 
    });
  }
});

// GET /api/emergency - Get emergencies (filtered by role)
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, limit = 50, page = 1 } = req.query;
    const userRole = req.user.role;

    let query = {};

    // Patients can only see their own emergencies
    if (userRole === 'patient') {
      query.patientId = req.user.id;
    }
    // Admins and doctors can see all emergencies
    // Optionally filter by assigned doctor
    if (userRole === 'doctor') {
      query.$or = [
        { assignedTo: req.user.id },
        { assignedTo: null },
        { status: 'pending' }
      ];
    }

    // Apply filters
    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const emergencies = await Emergency.find(query)
      .populate('patientId', 'name email phone avatar')
      .populate('assignedTo', 'name email phone role')
      .populate('response.acknowledgedBy', 'name role')
      .populate('response.resolvedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Emergency.countDocuments(query);

    res.json({
      emergencies,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching emergencies:', error);
    res.status(500).json({ error: 'Failed to fetch emergencies' });
  }
});

// GET /api/emergency/:id - Get a specific emergency
router.get('/:id', authenticate, async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id)
      .populate('patientId', 'name email phone avatar dateOfBirth')
      .populate('assignedTo', 'name email phone role specialty')
      .populate('response.acknowledgedBy', 'name role')
      .populate('response.resolvedBy', 'name role');

    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    // Check permissions
    const userRole = req.user.role;
    if (userRole === 'patient' && emergency.patientId._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(emergency);
  } catch (error) {
    console.error('Error fetching emergency:', error);
    res.status(500).json({ error: 'Failed to fetch emergency' });
  }
});

// PUT /api/emergency/:id/acknowledge - Acknowledge an emergency (admin/doctor)
router.put('/:id/acknowledge', authenticate, async (req, res) => {
  try {
    const userRole = req.user.role;
    if (userRole !== 'admin' && userRole !== 'doctor') {
      return res.status(403).json({ error: 'Only admins and doctors can acknowledge emergencies' });
    }

    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    if (emergency.status === 'resolved' || emergency.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot acknowledge a resolved or cancelled emergency' });
    }

    emergency.status = 'acknowledged';
    emergency.assignedTo = req.user.id;
    emergency.response.acknowledgedAt = new Date();
    emergency.response.acknowledgedBy = req.user.id;

    await emergency.save();

    // Emit update to patient
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${emergency.patientId}`).emit('emergency_acknowledged', {
        emergencyId: emergency._id,
        acknowledgedBy: req.user.name,
        message: 'Your emergency has been acknowledged. Help is on the way!'
      });
    }

    await emergency.populate('assignedTo', 'name email phone role');

    res.json({
      success: true,
      message: 'Emergency acknowledged successfully',
      emergency
    });
  } catch (error) {
    console.error('Error acknowledging emergency:', error);
    res.status(500).json({ error: 'Failed to acknowledge emergency' });
  }
});

// PUT /api/emergency/:id/status - Update emergency status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const userRole = req.user.role;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'acknowledged', 'in_progress', 'resolved', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    // Check permissions
    if (userRole === 'patient') {
      // Patients can only cancel their own emergencies
      if (status !== 'cancelled' || emergency.patientId.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Update status
    emergency.status = status;

    // Update response information
    if (status === 'in_progress' && !emergency.response.acknowledgedAt) {
      emergency.response.acknowledgedAt = new Date();
      emergency.response.acknowledgedBy = req.user.id;
      emergency.assignedTo = req.user.id;
    }

    if (status === 'resolved') {
      emergency.response.resolvedAt = new Date();
      emergency.response.resolvedBy = req.user.id;
      if (notes) {
        emergency.response.notes = notes;
      }
    }

    if (notes && status !== 'resolved') {
      emergency.response.notes = notes;
    }

    await emergency.save();

    // Emit update to patient
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${emergency.patientId}`).emit('emergency_status_update', {
        emergencyId: emergency._id,
        status,
        message: `Emergency status updated to ${status}`
      });
    }

    await emergency.populate('patientId', 'name email phone avatar');
    await emergency.populate('assignedTo', 'name email phone role');

    res.json({
      success: true,
      message: 'Emergency status updated successfully',
      emergency
    });
  } catch (error) {
    console.error('Error updating emergency status:', error);
    res.status(500).json({ error: 'Failed to update emergency status' });
  }
});

// POST /api/emergency/:id/call - Initiate call for emergency
router.post('/:id/call', authenticate, async (req, res) => {
  try {
    const userRole = req.user.role;
    if (userRole !== 'admin' && userRole !== 'doctor') {
      return res.status(403).json({ error: 'Only admins and doctors can initiate emergency calls' });
    }

    const emergency = await Emergency.findById(req.params.id)
      .populate('patientId', 'name email phone');

    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    emergency.callInitiated = true;
    await emergency.save();

    // Emit call notification to patient
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${emergency.patientId._id}`).emit('emergency_call', {
        emergencyId: emergency._id,
        callerName: req.user.name,
        message: 'Emergency call incoming'
      });
    }

    res.json({
      success: true,
      message: 'Emergency call initiated',
      emergency
    });
  } catch (error) {
    console.error('Error initiating emergency call:', error);
    res.status(500).json({ error: 'Failed to initiate emergency call' });
  }
});

// GET /api/emergency/stats - Get emergency statistics (admin only)
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const total = await Emergency.countDocuments();
    const pending = await Emergency.countDocuments({ status: 'pending' });
    const acknowledged = await Emergency.countDocuments({ status: 'acknowledged' });
    const inProgress = await Emergency.countDocuments({ status: 'in_progress' });
    const resolved = await Emergency.countDocuments({ status: 'resolved' });
    const critical = await Emergency.countDocuments({ priority: 'critical' });

    // Get emergencies by priority
    const byPriority = await Emergency.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get emergencies by status
    const byStatus = await Emergency.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      total,
      pending,
      acknowledged,
      inProgress,
      resolved,
      critical,
      byPriority,
      byStatus
    });
  } catch (error) {
    console.error('Error fetching emergency stats:', error);
    res.status(500).json({ error: 'Failed to fetch emergency statistics' });
  }
});

module.exports = router;

