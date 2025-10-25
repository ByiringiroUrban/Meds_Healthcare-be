
const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const { authenticate } = require('../middleware/auth');

// GET /api/courses - Get all active health guides
router.get('/', async (req, res) => {
  try {
    const { categoryId } = req.query;
    const filter = { isActive: true };
    if (categoryId) filter.categoryId = categoryId;
    
    const courses = await Course.find(filter)
      .populate('categoryId', 'name description')
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    console.error('Error fetching health guides:', error);
    res.status(500).json({ error: 'Failed to fetch health guides' });
  }
});

// GET /api/courses/all - Get all health guides (admin only)
router.get('/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    const courses = await Course.find()
      .populate('categoryId', 'name description')
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    console.error('Error fetching all health guides:', error);
    res.status(500).json({ error: 'Failed to fetch health guides' });
  }
});

// GET /api/courses/:id - Get health guide by ID
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ error: 'Health guide not found' });
    }
    
    // Increment views
    course.views += 1;
    await course.save();
    
    res.json(course);
  } catch (error) {
    console.error('Error fetching health guide:', error);
    res.status(500).json({ error: 'Failed to fetch health guide' });
  }
});

// POST /api/courses - Create new health guide (admin only)
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { 
      title, 
      summary, 
      content, 
      categoryId, 
      image, 
      videoUrl, 
      videoTitle 
    } = req.body;
    
    if (!title || !summary || !content || !categoryId) {
      return res.status(400).json({ 
        error: 'Title, summary, content, and category are required' 
      });
    }

    // Get category name for backward compatibility
    const Category = require('../models/Category');
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const course = new Course({
      title: title.trim(),
      summary: summary.trim(),
      content: content.trim(),
      categoryId,
      category: category.name,
      image: image || '/placeholder.svg',
      videoUrl: videoUrl || '',
      videoTitle: videoTitle || ''
    });

    await course.save();
    res.status(201).json(course);
  } catch (error) {
    console.error('Error creating health guide:', error);
    res.status(500).json({ error: 'Failed to create health guide' });
  }
});

// PUT /api/courses/:id - Update health guide (admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Health guide not found' });
    }

    const { 
      title, 
      summary, 
      content, 
      categoryId, 
      image, 
      videoUrl, 
      videoTitle,
      isActive 
    } = req.body;

    if (title !== undefined) course.title = title.trim();
    if (summary !== undefined) course.summary = summary.trim();
    if (content !== undefined) course.content = content.trim();
    if (categoryId !== undefined) {
      const Category = require('../models/Category');
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      course.categoryId = categoryId;
      course.category = category.name;
    }
    if (image !== undefined) course.image = image;
    if (videoUrl !== undefined) course.videoUrl = videoUrl;
    if (videoTitle !== undefined) course.videoTitle = videoTitle;
    if (isActive !== undefined) course.isActive = isActive;

    await course.save();
    res.json(course);
  } catch (error) {
    console.error('Error updating health guide:', error);
    res.status(500).json({ error: 'Failed to update health guide' });
  }
});

// DELETE /api/courses/:id - Delete health guide (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Health guide not found' });
    }

    res.json({ message: 'Health guide deleted successfully' });
  } catch (error) {
    console.error('Error deleting health guide:', error);
    res.status(500).json({ error: 'Failed to delete health guide' });
  }
});

module.exports = router;
