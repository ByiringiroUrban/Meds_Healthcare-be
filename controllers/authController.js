const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Specialty = require('../models/Specialty');
const validator = require('validator');
const { generateOTP, sendOTPEmail, sendWelcomeEmail } = require('../services/emailService');
const path = require('path');
const fs = require('fs');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const register = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      phone,
      role = 'patient',
      dateOfBirth,
      specialty,
      licenseNumber,
      experience,
      bio
    } = req.body;

    console.log('Registration request body:', req.body);

    // Validation
    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and phone number are required'
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phone: phone }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone number already exists'
      });
    }

    // Create user
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password, // Will be hashed by the pre-save middleware
      phone: phone.trim(),
      role
    };

    // Add role-specific fields
    if (role === 'patient' && dateOfBirth) {
      userData.dateOfBirth = new Date(dateOfBirth);
    }

    if (role === 'doctor') {
      if (!specialty || !licenseNumber || !experience) {
        return res.status(400).json({
          success: false,
          message: 'Specialty, license number, and experience are required for doctors'
        });
      }
      userData.specialty = specialty.trim();
      userData.licenseNumber = licenseNumber.trim();
      userData.experience = parseInt(experience);
      userData.bio = bio?.trim() || '';
      userData.verified = false; // Doctors need admin verification
    }

    // Generate OTP for email verification
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Add OTP fields to user data
    userData.emailVerificationOTP = otp;
    userData.emailVerificationOTPExpires = otpExpires;
    userData.isEmailVerified = false;

    const user = new User(userData);
    await user.save();

    // Send OTP email
    try {
      const emailResult = await sendOTPEmail(email, name, otp);
      if (!emailResult.success) {
        console.error('Failed to send OTP email:', emailResult.error);
        // Don't fail registration, but log the error
      }
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      // Don't fail registration, but log the error
    }

    // If doctor registration, also create entry in Doctor collection for homepage display
    if (role === 'doctor') {
      try {
        // Find or create specialty
        let specialtyDoc = await Specialty.findOne({ name: specialty });
        if (!specialtyDoc) {
          specialtyDoc = new Specialty({ 
            name: specialty, 
            description: `${specialty} specialty` 
          });
          await specialtyDoc.save();
        }

        // Create doctor entry for homepage display
        const doctorEntry = new Doctor({
          name: user.name,
          email: user.email,
          specialtyId: specialtyDoc._id,
          specialty: specialty,
          experience: experience,
          consultationFee: 50, // Default fee
          rating: 4.5, // Default rating
          qualifications: bio ? [bio] : [],
          isAvailable: false, // Initially false until verified
          isActive: false // Initially false until verified
        });
        
        await doctorEntry.save();
      } catch (doctorCreationError) {
        console.error('Error creating doctor entry:', doctorCreationError);
        // Don't fail the registration if doctor entry creation fails
      }
    }

    // Remove password and OTP from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailVerificationOTP;

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please check your email for verification code.',
      data: {
        user: userResponse,
        requiresVerification: true,
        message: 'Please check your email and enter the verification code to complete your registration.'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
};
const login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    if (
      !emailOrPhone ||
      !password ||
      emailOrPhone.trim() === "" ||
      password.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Email/phone and password are required",
      });
    }

    // Clean input
    const cleanedInput = emailOrPhone.toLowerCase().trim();

    // Determine if input is email or phone
    const isEmail = cleanedInput.includes("@");
    const isPhone = /^\+?[\d\s\-\(\)]+$/.test(cleanedInput.replace(/\s/g, ""));

    if (!isEmail && !isPhone) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address or phone number",
      });
    }

    // Build query object
    let query = {};
    if (isEmail) {
      query.email = cleanedInput;
    } else {
      // Clean phone number (remove spaces, dashes, parentheses)
      const cleanedPhone = cleanedInput.replace(/[\s\-\(\)]/g, "");
      query.phone = cleanedPhone;
    }

    // Find user by email or phone
    // Find user by email or phone
    let user = await User.findOne(query).select("+password");
console.log("user",user)
    // If not found in User table, try Doctor table
    if (!user) {
      user = await Doctor.findOne(query).select("+password");
console.log("doctor ",user)
      // If found in Doctor table, set role to 'doctor' for consistency
    
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Please contact support.",
      });
    }



    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during login",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    
    res.json({
      success: true,
      data: { token }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if OTP matches and is not expired
    if (user.emailVerificationOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    if (new Date() > user.emailVerificationOTPExpires) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    // Update user as verified
    user.isEmailVerified = true;
    user.emailVerificationOTP = null;
    user.emailVerificationOTPExpires = null;
    await user.save();

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail verification if welcome email fails
    }

    // Generate token for verified user
    const token = generateToken(user._id);

    // Remove sensitive data from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailVerificationOTP;

    res.json({
      success: true,
      message: 'Email verified successfully! Welcome to Meds Healthcare!',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during verification'
    });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Update user with new OTP
    user.emailVerificationOTP = otp;
    user.emailVerificationOTPExpires = otpExpires;
    await user.save();

    // Send new OTP email
    try {
      const emailResult = await sendOTPEmail(user.email, user.name, otp);
      if (!emailResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to send verification email. Please try again.'
        });
      }
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.'
      });
    }

    res.json({
      success: true,
      message: 'New verification code sent to your email'
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Upload profile image
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const userId = req.user._id;
    const imagePath = `/uploads/${req.file.filename}`;
    
    // Update user's avatar
    const user = await User.findByIdAndUpdate(
      userId,
      { avatar: imagePath },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If it's a doctor, also update the Doctor collection
    if (user.role === 'doctor') {
      await Doctor.findOneAndUpdate(
        { email: user.email },
        { avatar: imagePath }
      );
    }

    res.json({
      success: true,
      message: 'Profile image updated successfully',
      data: {
        avatar: imagePath
      }
    });

  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during image upload'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, email, phone, bio, specialty, experience, consultationFee, dateOfBirth, address } = req.body;

    const updateData = {};
    
    if (name) updateData.name = name.trim();
    if (email) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ 
        email: email.toLowerCase().trim(),
        _id: { $ne: userId }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another account'
        });
      }
      updateData.email = email.toLowerCase().trim();
    }
    if (phone) updateData.phone = phone.trim();
    if (bio) updateData.bio = bio.trim();
    if (specialty) updateData.specialty = specialty.trim();
    if (experience) updateData.experience = parseInt(experience);
    if (consultationFee) updateData.consultationFee = parseFloat(consultationFee);
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (!isNaN(dob.getTime())) {
        updateData.dateOfBirth = dob;
      }
    }
    if (address !== undefined) updateData.address = address ? address.trim() : '';
    if (req.body.avatar !== undefined) updateData.avatar = req.body.avatar;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If it's a doctor, also update the Doctor collection
    if (user.role === 'doctor') {
      const doctorUpdateData = {};
      if (name) doctorUpdateData.name = name.trim();
      if (bio) doctorUpdateData.qualifications = [bio.trim()];
      if (specialty) doctorUpdateData.specialty = specialty.trim();
      if (experience) doctorUpdateData.experience = parseInt(experience);
      if (consultationFee) doctorUpdateData.consultationFee = parseFloat(consultationFee);

      await Doctor.findOneAndUpdate(
        { email: user.email },
        doctorUpdateData
      );
    }

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailVerificationOTP;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during profile update'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  logout,
  refreshToken,
  verifyOTP,
  resendOTP,
  uploadProfileImage,
  updateProfile
};
