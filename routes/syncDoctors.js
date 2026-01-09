const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

// POST /api/sync-doctors - Sync all doctors with User collection (admin only)
// This ensures all doctors in Doctor collection have corresponding User entries
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    console.log('🔄 Starting doctor sync process...');
    
    // Get all doctors
    const doctors = await Doctor.find();
    console.log(`📋 Found ${doctors.length} doctors to sync`);
    
    let synced = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const doctor of doctors) {
      try {
        const user = await User.findOne({ email: doctor.email.toLowerCase().trim() });
        
        if (user) {
          // Update existing user
          user.name = doctor.name;
          user.role = 'doctor';
          user.specialty = doctor.specialty;
          user.experience = doctor.experience;
          user.bio = doctor.qualifications ? doctor.qualifications.join(', ') : '';
          user.verified = true;
          user.isActive = doctor.isActive !== false;
          await user.save();
          updated++;
          console.log(`✅ Updated User for doctor: ${doctor.name}`);
        } else {
          // Create new user
          const newUser = new User({
            name: doctor.name,
            email: doctor.email.toLowerCase().trim(),
            phone: `+249${Math.floor(Math.random() * 1000000000)}`,
            password: 'defaultPassword123', // Default password - should be changed
            role: 'doctor',
            specialty: doctor.specialty,
            licenseNumber: `LIC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            experience: doctor.experience,
            bio: doctor.qualifications ? doctor.qualifications.join(', ') : '',
            verified: true,
            isActive: doctor.isActive !== false
          });
          await newUser.save();
          created++;
          console.log(`✅ Created User for doctor: ${doctor.name}`);
        }
        synced++;
      } catch (error) {
        errors++;
        console.error(`❌ Error syncing doctor ${doctor.name}:`, error.message);
      }
    }

    console.log(`✅ Sync complete: ${synced} synced, ${created} created, ${updated} updated, ${errors} errors`);
    
    res.json({
      success: true,
      message: 'Doctor sync completed',
      stats: {
        total: doctors.length,
        synced,
        created,
        updated,
        errors
      }
    });
  } catch (error) {
    console.error('❌ Error in doctor sync:', error);
    res.status(500).json({ error: 'Failed to sync doctors', details: error.message });
  }
});

module.exports = router;


