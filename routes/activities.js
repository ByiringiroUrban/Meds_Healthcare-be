
const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const { authenticate } = require('../middleware/auth');

// GET /api/activities - Get recent activities (admin only)
router.get('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    const activities = await Activity.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// POST /api/activities - Create activity (admin only)
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { title, description, type, userId, metadata } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ 
        error: 'Title and description are required' 
      });
    }

    const activity = new Activity({
      title: title.trim(),
      description: description.trim(),
      type: type || 'other',
      userId: userId || null,
      metadata: metadata || {}
    });

    await activity.save();
    const populatedActivity = await Activity.findById(activity._id).populate('userId', 'name email');
    res.status(201).json(populatedActivity);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// PUT /api/activities/:id - Update activity (admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const { title, description, type, isRead, metadata } = req.body;

    if (title !== undefined) activity.title = title.trim();
    if (description !== undefined) activity.description = description.trim();
    if (type !== undefined) activity.type = type;
    if (isRead !== undefined) activity.isRead = isRead;
    if (metadata !== undefined) activity.metadata = metadata;

    await activity.save();
    const populatedActivity = await Activity.findById(activity._id).populate('userId', 'name email');
    res.json(populatedActivity);
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// DELETE /api/activities/:id - Delete activity (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

module.exports = router;
