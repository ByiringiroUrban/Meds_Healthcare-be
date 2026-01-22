
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const {
  register,
  login,
  getProfile,
  logout,
  refreshToken,
  verifyOTP,
  resendOTP,
  uploadProfileImage,
  updateProfile
} = require('../controllers/authController');
const { upload, handleUploadError } = require('../middleware/upload');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (patient, doctor, admin)
 * @access  Public
 * @body    { name, email, phone, password, role, dateOfBirth?, specialty?, licenseNumber?, experience?, bio? }
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user with email/phone and password
 * @access  Public
 * @body    { identifier, password, role? }
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, getProfile);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh', authenticate, refreshToken);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify email with OTP
 * @access  Public
 * @body    { email, otp }
 */
router.post('/verify-otp', verifyOTP);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP for email verification
 * @access  Public
 * @body    { email }
 */
router.post('/resend-otp', resendOTP);

/**
 * @route   POST /api/auth/upload-image
 * @desc    Upload profile image
 * @access  Private
 * @body    FormData with image file
 */
router.post('/upload-image', authenticate, upload.single('image'), handleUploadError, uploadProfileImage);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 * @body    { name?, phone?, bio?, specialty?, experience?, consultationFee? }
 */
router.put('/profile', authenticate, updateProfile);

// GET /api/auth/users - Get all users (admin only)
router.get('/users', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/auth/users/:id - Update user (admin only)
router.put('/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, email, phone, role, verified, isActive } = req.body;

    if (name !== undefined) user.name = name.trim();
    if (email !== undefined) user.email = email.toLowerCase().trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (role !== undefined) user.role = role;
    if (verified !== undefined) user.verified = verified;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /api/auth/users - Create user (admin only)
router.post('/users', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { name, email, phone, role, password } = req.body;

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or phone already exists' });
    }

    // Create user with verified status for doctors created by admin
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      role,
      verified: true, // Admin-created users are automatically verified
      isActive: true
    };

    const user = new User(userData);
    await user.save();

    // If doctor, create Doctor entry as well
    if (role === 'doctor') {
      const Doctor = require('../models/Doctor');
      const Specialty = require('../models/Specialty');
      
      // Create a default specialty if needed
      let specialtyDoc = await Specialty.findOne({ name: 'General Medicine' });
      if (!specialtyDoc) {
        specialtyDoc = new Specialty({ 
          name: 'General Medicine', 
          description: 'General medical practice' 
        });
        await specialtyDoc.save();
      }

      const doctorEntry = new Doctor({
        name: user.name,
        email: user.email,
        specialtyId: specialtyDoc._id,
        specialty: 'General Medicine',
        experience: 5,
        consultationFee: 50,
        rating: 4.5,
        qualifications: [],
        isAvailable: true, // Admin-created doctors are active
        isActive: true
      });
      
      await doctorEntry.save();
    }

    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// DELETE /api/auth/users/:id - Delete user (admin only)
router.delete('/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/auth/settings - Get user settings
router.get('/settings', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('settings');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return default settings if none exist
    const defaultSettings = {
      notifications: {
        email: true,
        sms: false,
        push: true,
        appointmentReminders: true,
        healthTips: true
      },
      privacy: {
        profileVisibility: 'private',
        dataSharing: false,
        analytics: true
      },
      preferences: {
        language: 'en',
        theme: 'light',
        timezone: 'UTC'
      }
    };

    res.json(user.settings || defaultSettings);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/auth/settings - Update user settings
router.put('/settings', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { notifications, privacy, preferences } = req.body;

    // Update settings if provided
    if (notifications) {
      user.settings = user.settings || {};
      user.settings.notifications = {
        ...user.settings.notifications,
        ...notifications
      };
    }

    if (privacy) {
      user.settings = user.settings || {};
      user.settings.privacy = {
        ...user.settings.privacy,
        ...privacy
      };
    }

    if (preferences) {
      user.settings = user.settings || {};
      user.settings.preferences = {
        ...user.settings.preferences,
        ...preferences
      };
    }

    await user.save();

    // Return updated settings
    const defaultSettings = {
      notifications: {
        email: true,
        sms: false,
        push: true,
        appointmentReminders: true,
        healthTips: true
      },
      privacy: {
        profileVisibility: 'private',
        dataSharing: false,
        analytics: true
      },
      preferences: {
        language: 'en',
        theme: 'light',
        timezone: 'UTC'
      }
    };

    res.json(user.settings || defaultSettings);
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
