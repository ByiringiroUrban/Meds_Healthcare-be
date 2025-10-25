
const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { authenticate } = require('../middleware/auth');

// GET /api/blogs - Get all published blogs
router.get('/', async (req, res) => {
  try {
    const blogs = await Blog.find({ isPublished: true })
      .populate('authorId', 'name')
      .sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

// GET /api/blogs/all - Get all blogs (admin only)
router.get('/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    const blogs = await Blog.find()
      .populate('authorId', 'name')
      .sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    console.error('Error fetching all blogs:', error);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

// GET /api/blogs/my - Get user's blogs (doctor/admin only)
router.get('/my', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Access denied. Admin or Doctor only.' });
    }
    
    const blogs = await Blog.find({ authorId: req.user._id })
      .populate('authorId', 'name')
      .sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    console.error('Error fetching user blogs:', error);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

// GET /api/blogs/:id - Get blog by ID
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate('authorId', 'name');
    
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    
    // Increment views
    blog.views += 1;
    await blog.save();
    
    res.json(blog);
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({ error: 'Failed to fetch blog' });
  }
});

// POST /api/blogs - Create new blog (admin/doctor only)
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Access denied. Admin or Doctor only.' });
    }

    const { 
      title, 
      excerpt, 
      content, 
      category, 
      tags, 
      image, 
      readTime 
    } = req.body;
    
    if (!title || !excerpt || !content || !category) {
      return res.status(400).json({ 
        error: 'Title, excerpt, content, and category are required' 
      });
    }

    const blog = new Blog({
      title: title.trim(),
      excerpt: excerpt.trim(),
      content: content.trim(),
      author: req.user.name,
      authorId: req.user._id,
      category: category.trim(),
      tags: tags || [],
      image: image || '/placeholder.svg',
      readTime: readTime || '5 min read'
    });

    await blog.save();
    const populatedBlog = await Blog.findById(blog._id).populate('authorId', 'name');
    res.status(201).json(populatedBlog);
  } catch (error) {
    console.error('Error creating blog:', error);
    res.status(500).json({ error: 'Failed to create blog' });
  }
});

// PUT /api/blogs/:id - Update blog (author or admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Check if user is author or admin
    if (req.user.role !== 'admin' && blog.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only edit your own blogs.' });
    }

    const { 
      title, 
      excerpt, 
      content, 
      category, 
      tags, 
      image, 
      readTime,
      isPublished 
    } = req.body;

    if (title !== undefined) blog.title = title.trim();
    if (excerpt !== undefined) blog.excerpt = excerpt.trim();
    if (content !== undefined) blog.content = content.trim();
    if (category !== undefined) blog.category = category.trim();
    if (tags !== undefined) blog.tags = tags;
    if (image !== undefined) blog.image = image;
    if (readTime !== undefined) blog.readTime = readTime;
    if (isPublished !== undefined) blog.isPublished = isPublished;

    await blog.save();
    const populatedBlog = await Blog.findById(blog._id).populate('authorId', 'name');
    res.json(populatedBlog);
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({ error: 'Failed to update blog' });
  }
});

// DELETE /api/blogs/:id - Delete blog (author or admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Check if user is author or admin
    if (req.user.role !== 'admin' && blog.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only delete your own blogs.' });
    }

    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Blog deleted successfully' });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({ error: 'Failed to delete blog' });
  }
});

module.exports = router;
