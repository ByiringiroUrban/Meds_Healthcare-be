
const express = require('express');
const router = express.Router();
const Testimonial = require('../models/Testimonial');
const { authenticate } = require('../middleware/auth');

// GET /api/testimonials - Get all approved testimonials (or all for testing)
router.get('/', async (req, res) => {
  try {
    // For now, show all active testimonials (not just approved ones) to see them on homepage
    const testimonials = await Testimonial.find({ isActive: true })
      .sort({ createdAt: -1 });
    res.json(testimonials);
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

// GET /api/testimonials/all - Get all testimonials (admin only)
router.get('/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    const testimonials = await Testimonial.find()
      .sort({ createdAt: -1 });
    res.json(testimonials);
  } catch (error) {
    console.error('Error fetching all testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

// POST /api/testimonials - Create new testimonial
router.post('/', authenticate, async (req, res) => {
  try {
    const { content, rating, treatment } = req.body;
    
    if (!content || !rating) {
      return res.status(400).json({ 
        error: 'Content and rating are required' 
      });
    }

    const testimonial = new Testimonial({
      patientName: req.user.name,
      patientEmail: req.user.email,
      content: content.trim(),
      rating,
      treatment: treatment || '',
      avatar: req.user.avatar || '/placeholder.svg'
    });

    await testimonial.save();
    res.status(201).json(testimonial);
  } catch (error) {
    console.error('Error creating testimonial:', error);
    res.status(500).json({ error: 'Failed to create testimonial' });
  }
});

// PUT /api/testimonials/:id/approve - Approve testimonial (admin only)
router.put('/:id/approve', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );

    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    res.json(testimonial);
  } catch (error) {
    console.error('Error approving testimonial:', error);
    res.status(500).json({ error: 'Failed to approve testimonial' });
  }
});

// DELETE /api/testimonials/:id - Delete testimonial (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    res.json({ message: 'Testimonial deleted successfully' });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).json({ error: 'Failed to delete testimonial' });
  }
});

module.exports = router;
