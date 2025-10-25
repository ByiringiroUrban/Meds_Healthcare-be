const express = require('express');
const router = express.Router();
const Stats = require('../models/Stats');
const { authenticate } = require('../middleware/auth');

// GET /api/stats - Get current stats
router.get('/', async (req, res) => {
  try {
    let stats = await Stats.findOne();
    
    // If no stats exist, create default ones
    if (!stats) {
      stats = new Stats({
        expertDoctors: 50,
        happyPatients: 1000,
        medicalDepartments: 15,
        emergencySupport: '24/7'
      });
      await stats.save();
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// PUT /api/stats - Update stats (admin only)
router.put('/', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { expertDoctors, happyPatients, medicalDepartments, emergencySupport } = req.body;
    
    let stats = await Stats.findOne();
    
    if (!stats) {
      stats = new Stats();
    }
    
    if (expertDoctors !== undefined) stats.expertDoctors = expertDoctors;
    if (happyPatients !== undefined) stats.happyPatients = happyPatients;
    if (medicalDepartments !== undefined) stats.medicalDepartments = medicalDepartments;
    if (emergencySupport !== undefined) stats.emergencySupport = emergencySupport;
    
    await stats.save();
    
    res.json(stats);
  } catch (error) {
    console.error('Error updating stats:', error);
    res.status(500).json({ error: 'Failed to update stats' });
  }
});

module.exports = router;