const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Doctor = require('../models/Doctor');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request object.
 * Supports both User and Doctor collections (doctors may log in via either).
 */
const authenticate = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware called for:', req.method, req.url);
    
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    console.log('🔑 Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Auth failed: No token or invalid format');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by ID from token (User collection first)
    let user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      // Try Doctor collection (doctors may log in via Doctor table)
      const doctor = await Doctor.findById(decoded.userId).select('-password').lean();
      if (doctor) {
        user = {
          _id: doctor._id,
          id: doctor._id.toString(),
          name: doctor.name,
          email: doctor.email,
          role: 'doctor',
          isActive: doctor.isActive !== false,
          avatar: doctor.image,
          specialty: doctor.specialty,
          experience: doctor.experience
        };
      }
    }
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Check if user is active
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

/**
 * Authorization middleware factory
 * Creates middleware to check if user has required role(s)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };