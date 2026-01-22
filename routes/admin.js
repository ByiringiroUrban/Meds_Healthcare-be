const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Specialty = require('../models/Specialty');
const Activity = require('../models/Activity');
const { authenticate } = require('../middleware/auth');

// GET /api/admin/dashboard/stats - Get admin dashboard statistics
router.get('/dashboard/stats', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    // Get total users count
    const totalUsers = await User.countDocuments();
    
    // Get total doctors count
    const totalDoctors = await Doctor.countDocuments();
    
    // Get total appointments count
    const totalAppointments = await Appointment.countDocuments();
    
    // Get total specialties count
    const totalSpecialties = await Specialty.countDocuments();
    
    // Get appointments by status
    const appointmentsByStatus = await Appointment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get users by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get recent appointments (last 10)
    const recentAppointments = await Appointment.find()
      .populate('doctorId', 'name email')
      .populate('specialtyId', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Get recent activities (last 10)
    const recentActivities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Calculate this month's appointments
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthAppointments = await Appointment.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Calculate today's appointments
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayAppointments = await Appointment.countDocuments({
      createdAt: { $gte: startOfDay }
    });

    res.json({
      totalUsers,
      totalDoctors,
      totalAppointments,
      totalSpecialties,
      thisMonthAppointments,
      todayAppointments,
      appointmentsByStatus: appointmentsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recentAppointments: recentAppointments.map(apt => ({
        _id: apt._id,
        patientName: apt.patientName,
        doctorName: apt.doctorId?.name || 'Unknown',
        specialtyName: apt.specialtyId?.name || 'Unknown',
        appointmentDate: apt.appointmentDate,
        status: apt.status,
        createdAt: apt.createdAt
      })),
      recentActivities
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// PUT /api/admin/verify-doctor/:id - Verify doctor and enable them
router.put('/verify-doctor/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { id } = req.params;
    
    // Update Doctor collection
    const doctor = await Doctor.findByIdAndUpdate(
      id,
      { 
        isActive: true,
        isAvailable: true 
      },
      { new: true }
    ).populate('specialtyId', 'name description');

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Update corresponding User account if exists
    await User.findOneAndUpdate(
      { email: doctor.email },
      { 
        verified: true,
        isActive: true 
      }
    );

    res.json({ 
      message: 'Doctor verified successfully',
      doctor 
    });
  } catch (error) {
    console.error('Error verifying doctor:', error);
    res.status(500).json({ error: 'Failed to verify doctor' });
  }
});

// PUT /api/admin/unverify-doctor/:id - Unverify doctor and disable them
router.put('/unverify-doctor/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { id } = req.params;
    
    // Update Doctor collection
    const doctor = await Doctor.findByIdAndUpdate(
      id,
      { 
        isActive: false,
        isAvailable: false 
      },
      { new: true }
    ).populate('specialtyId', 'name description');

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Update corresponding User account if exists
    await User.findOneAndUpdate(
      { email: doctor.email },
      { 
        verified: false,
        isActive: false 
      }
    );

    res.json({ 
      message: 'Doctor unverified successfully',
      doctor 
    });
  } catch (error) {
    console.error('Error unverifying doctor:', error);
    res.status(500).json({ error: 'Failed to unverify doctor' });
  }
});

// POST /api/admin/fix-doctor-verification - Fix all doctor verification issues
router.post('/fix-doctor-verification', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { fixDoctorVerification } = require('../scripts/fixDoctorVerification');
    await fixDoctorVerification();
    
    res.json({ 
      message: 'Doctor verification issues fixed successfully',
      success: true 
    });
  } catch (error) {
    console.error('Error fixing doctor verification:', error);
    res.status(500).json({ error: 'Failed to fix doctor verification' });
  }
});

module.exports = router;
