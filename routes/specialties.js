
const express = require('express');
const router = express.Router();
const Specialty = require('../models/Specialty');
const Category = require('../models/Category');
const { authenticate } = require('../middleware/auth');

// GET /api/specialties - Get all active specialties (PUBLIC)
router.get('/', async (req, res) => {
  try {
    const Doctor = require('../models/Doctor');
    const User = require('../models/User');

    // Auto-sync specialties from Doctor and User collections
    const doctorRecords = await Doctor.find({ specialty: { $exists: true, $ne: '' } }).select('specialty').lean();
    const userDoctorRecords = await User.find({ role: 'doctor', specialty: { $exists: true, $ne: '' } }).select('specialty').lean();

    const allDoctorSpecialties = [...doctorRecords, ...userDoctorRecords];

    for (const doc of allDoctorSpecialties) {
      if (doc.specialty && doc.specialty.trim()) {
        const cleanName = doc.specialty.trim();
        const exists = await Specialty.exists({
          name: new RegExp(`^${cleanName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')
        });
        if (!exists) {
          try {
            await Specialty.create({
              name: cleanName,
              description: `${cleanName} specialty`,
              isActive: true
            });
          } catch (e) {
            // Ignore duplicate key errors
          }
        }
      }
    }

    const specialties = await Specialty.find({ isActive: true }).sort({ name: 1 });
    res.json(specialties);
  } catch (error) {
    console.error('Error fetching specialties:', error);
    res.status(500).json({ error: 'Failed to fetch specialties' });
  }
});

// GET /api/specialties/all - Get all specialties (admin only)
router.get('/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    const specialties = await Specialty.find().sort({ name: 1 });
    res.json(specialties);
  } catch (error) {
    console.error('Error fetching all specialties:', error);
    res.status(500).json({ error: 'Failed to fetch specialties' });
  }
});

// POST /api/specialties - Create new specialty (admin only)
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { name, description, icon } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }

    const specialty = new Specialty({
      name: name.trim(),
      description: description.trim(),
      icon: icon || 'stethoscope'
    });

    await specialty.save();

    // Auto-create corresponding category for health awareness content
    try {
      const existingCategory = await Category.findOne({ name: name.trim() });
      if (!existingCategory) {
        const category = new Category({
          name: name.trim(),
          description: `Health awareness content for ${name.trim()}`,
          icon: icon || 'stethoscope'
        });
        await category.save();
        console.log(`✅ Auto-created category: ${name.trim()}`);
      }
    } catch (categoryError) {
      console.log(`⚠️ Category already exists or error creating: ${name.trim()}`);
    }

    res.status(201).json(specialty);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Specialty name already exists' });
    }
    console.error('Error creating specialty:', error);
    res.status(500).json({ error: 'Failed to create specialty' });
  }
});

// PUT /api/specialties/:id - Update specialty (admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { name, description, icon, isActive } = req.body;
    
    const specialty = await Specialty.findById(req.params.id);
    if (!specialty) {
      return res.status(404).json({ error: 'Specialty not found' });
    }

    if (name !== undefined) specialty.name = name.trim();
    if (description !== undefined) specialty.description = description.trim();
    if (icon !== undefined) specialty.icon = icon;
    if (isActive !== undefined) specialty.isActive = isActive;

    await specialty.save();

    // Update corresponding category if name changed
    if (name !== undefined) {
      try {
        const category = await Category.findOne({ name: req.body.originalName || specialty.name });
        if (category) {
          category.name = name.trim();
          category.description = `Health awareness content for ${name.trim()}`;
          if (icon !== undefined) category.icon = icon;
          await category.save();
          console.log(`✅ Updated category: ${name.trim()}`);
        }
      } catch (categoryError) {
        console.log(`⚠️ Error updating category: ${name.trim()}`);
      }
    }

    res.json(specialty);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Specialty name already exists' });
    }
    console.error('Error updating specialty:', error);
    res.status(500).json({ error: 'Failed to update specialty' });
  }
});

// DELETE /api/specialties/:id - Delete specialty (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const specialty = await Specialty.findByIdAndDelete(req.params.id);
    if (!specialty) {
      return res.status(404).json({ error: 'Specialty not found' });
    }

    res.json({ message: 'Specialty deleted successfully' });
  } catch (error) {
    console.error('Error deleting specialty:', error);
    res.status(500).json({ error: 'Failed to delete specialty' });
  }
});

module.exports = router;
