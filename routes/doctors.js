const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const Specialty = require('../models/Specialty');
const { authenticate } = require('../middleware/auth');

// GET /api/doctors - Get all active doctors
router.get('/', async (req, res) => {
  try {
    const { specialty } = req.query;
    let query = { isActive: true };
    
    if (specialty) {
      query.specialty = specialty;
    }
    
    const doctors = await Doctor.find(query)
      .populate('specialtyId', 'name description')
      .sort({ name: 1 });
    
    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// GET /api/doctors/all - Get all doctors (admin only)
router.get('/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    const doctors = await Doctor.find()
      .populate('specialtyId', 'name description')
      .sort({ name: 1 });
    
    res.json(doctors);
  } catch (error) {
    console.error('Error fetching all doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// GET /api/doctors/:id - Get doctor by ID (handles both Doctor and User IDs)
router.get('/:id', async (req, res) => {
  try {
    // First, try to find in Doctor collection
    let doctor = await Doctor.findById(req.params.id)
      .populate('specialtyId', 'name description');
    
    if (doctor) {
      return res.json(doctor);
    }
    
    // If not found in Doctor collection, try User collection
    const User = require('../models/User');
    const user = await User.findById(req.params.id);
    
    if (user && user.role === 'doctor') {
      // Try to find doctor by email
      doctor = await Doctor.findOne({ email: user.email.toLowerCase().trim() })
        .populate('specialtyId', 'name description');
      
      if (doctor) {
        return res.json(doctor);
      }
      
      // If doctor doesn't exist in Doctor collection, create a basic entry
      // This handles cases where doctor was created in User but not synced
      const Specialty = require('../models/Specialty');
      let specialtyDoc = await Specialty.findOne({ name: user.specialty || 'General Medicine' });
      
      if (!specialtyDoc) {
        specialtyDoc = await Specialty.findOne({ name: 'General Medicine' });
        if (!specialtyDoc) {
          specialtyDoc = new Specialty({ 
            name: 'General Medicine', 
            description: 'General medical practice' 
          });
          await specialtyDoc.save();
        }
      }
      
      // Create doctor entry from user data
      doctor = new Doctor({
        name: user.name,
        email: user.email.toLowerCase().trim(),
        specialtyId: specialtyDoc._id,
        specialty: user.specialty || 'General Medicine',
        experience: user.experience || 5,
        consultationFee: 50,
        rating: 4.5,
        qualifications: user.bio ? [user.bio] : [],
        isAvailable: true,
        isActive: true
      });
      
      await doctor.save();
      console.log('✅ Created Doctor entry from User:', doctor.email);
      
      const populatedDoctor = await Doctor.findById(doctor._id)
        .populate('specialtyId', 'name description');
      
      return res.json(populatedDoctor);
    }
    
    // Not found in either collection
    return res.status(404).json({ error: 'Doctor not found' });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({ error: 'Failed to fetch doctor', details: error.message });
  }
});

// POST /api/doctors - Create new doctor (admin only)
router.post('/', authenticate, async (req, res) => {
  console.log(req.body)
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { 
      name, 
      email, 
      specialtyId, 
      experience, 
      rating, 
      image, 
      qualifications, 
      availability, 
      consultationFee,
      phone,
      password = 'defaultPassword123' // Default password for admin-created doctors
    } = req.body;
    
    if (!name || !email || !specialtyId || !experience || !consultationFee) {
      return res.status(400).json({ 
        error: 'Name, email, specialty, experience, and consultation fee are required' 
      });
    }

    // Get specialty name
    const specialty = await Specialty.findById(specialtyId);
    if (!specialty) {
      return res.status(400).json({ error: 'Invalid specialty' });
    }

    // Create doctor in Doctor collection
    const doctor = new Doctor({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      specialtyId,
      specialty: specialty.name,
      experience,
      rating: rating || 4.5,
      image: image || '/placeholder.svg',
      qualifications: qualifications || [],
      availability: availability || {},
      consultationFee,
      password
    });

    await doctor.save();

    // CRITICAL: Always create/update corresponding User entry for chat and login access
    const User = require('../models/User');
    
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      
      if (existingUser) {
        // Update existing user to ensure it matches doctor data
        existingUser.name = name.trim();
        existingUser.role = 'doctor';
        existingUser.specialty = specialty.name;
        existingUser.experience = experience;
        existingUser.bio = qualifications ? qualifications.join(', ') : '';
        existingUser.verified = true;
        existingUser.isActive = true;
        // Update password if provided
        if (password && password !== 'defaultPassword123') {
          existingUser.password = password;
        }
        await existingUser.save();
        console.log('✅ Updated existing User entry for doctor:', existingUser.email);
      } else {
        // Create new user entry
        const userEntry = new User({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone || `+249${Math.floor(Math.random() * 1000000000)}`, // Generate random phone if not provided
          password: password,
          role: 'doctor',
          specialty: specialty.name,
          licenseNumber: `LIC_${Date.now()}`, // Generate unique license number
          experience: experience,
          bio: qualifications ? qualifications.join(', ') : '',
          verified: true, // Admin-created doctors are pre-verified
          isActive: true
        });
        
        await userEntry.save();
        console.log('✅ Created new User entry for doctor:', userEntry.email);
      }
    } catch (userCreationError) {
      console.error('❌ Error creating/updating user entry for doctor:', userCreationError);
      // If user creation fails, we should still have the doctor, but log the error
      // This ensures doctors are always created even if User sync fails
    }
    
    const populatedDoctor = await Doctor.findById(doctor._id)
      .populate('specialtyId', 'name description');
    
    res.status(201).json(populatedDoctor);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Error creating doctor:', error);
    res.status(500).json({ error: 'Failed to create doctor' });
  }
});

// PUT /api/doctors/:id - Update doctor (admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const { 
      name, 
      email, 
      specialtyId, 
      experience, 
      rating, 
      image, 
      qualifications, 
      availability, 
      consultationFee,
      isActive 
    } = req.body;

    // Update specialty if changed
    if (specialtyId && specialtyId !== doctor.specialtyId.toString()) {
      const specialty = await Specialty.findById(specialtyId);
      if (!specialty) {
        return res.status(400).json({ error: 'Invalid specialty' });
      }
      doctor.specialtyId = specialtyId;
      doctor.specialty = specialty.name;
    }

    if (name !== undefined) doctor.name = name.trim();
    if (email !== undefined) doctor.email = email.toLowerCase().trim();
    if (experience !== undefined) doctor.experience = experience;
    if (rating !== undefined) doctor.rating = rating;
    if (image !== undefined) doctor.image = image;
    if (qualifications !== undefined) doctor.qualifications = qualifications;
    if (availability !== undefined) doctor.availability = { ...doctor.availability, ...availability };
    if (consultationFee !== undefined) doctor.consultationFee = consultationFee;
    if (isActive !== undefined) doctor.isActive = isActive;

    await doctor.save();
    
    // CRITICAL: Sync User collection when doctor is updated
    try {
      const User = require('../models/User');
      await User.findOneAndUpdate(
        { email: doctor.email.toLowerCase().trim() },
        { 
          name: doctor.name,
          experience: doctor.experience,
          bio: doctor.qualifications ? doctor.qualifications.join(', ') : '',
          specialty: doctor.specialty,
          role: 'doctor',
          verified: true,
          isActive: doctor.isActive !== false
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log('✅ Synced User entry after doctor update:', doctor.email);
    } catch (userUpdateError) {
      console.error('❌ Error syncing user after doctor update:', userUpdateError);
    }
    
    const populatedDoctor = await Doctor.findById(doctor._id)
      .populate('specialtyId', 'name description');
    
    res.json(populatedDoctor);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: 'Failed to update doctor' });
  }
});

// DELETE /api/doctors/:id - Delete doctor (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Also delete corresponding User entry
    try {
      const User = require('../models/User');
      await User.findOneAndDelete({ email: doctor.email.toLowerCase().trim() });
      console.log('✅ Deleted User entry for doctor:', doctor.email);
    } catch (userDeleteError) {
      console.error('❌ Error deleting user entry:', userDeleteError);
      // Continue with doctor deletion even if user deletion fails
    }

    await Doctor.findByIdAndDelete(req.params.id);
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({ error: 'Failed to delete doctor' });
  }
});

// PUT /api/doctors/profile - Update doctor profile (doctor only)
router.put('/profile', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Access denied. Doctor only.' });
    }

    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const { 
      name, 
      email, 
      experience, 
      image, 
      qualifications, 
      availability, 
      consultationFee 
    } = req.body;

    if (name !== undefined) doctor.name = name.trim();
    if (email !== undefined) doctor.email = email.toLowerCase().trim();
    if (experience !== undefined) doctor.experience = experience;
    if (image !== undefined) doctor.image = image;
    if (qualifications !== undefined) doctor.qualifications = qualifications;
    if (availability !== undefined) doctor.availability = { ...doctor.availability, ...availability };
    if (consultationFee !== undefined) doctor.consultationFee = consultationFee;

    await doctor.save();

    // CRITICAL: Always sync User collection to ensure chat works
    try {
      const User = require('../models/User');
      const userUpdate = await User.findOneAndUpdate(
        { email: doctor.email.toLowerCase().trim() },
        { 
          name: doctor.name,
          experience: doctor.experience,
          bio: doctor.qualifications ? doctor.qualifications.join(', ') : '',
          specialty: doctor.specialty,
          role: 'doctor',
          verified: true,
          isActive: true
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log('✅ Synced User entry for doctor:', userUpdate.email);
    } catch (userUpdateError) {
      console.error('❌ Error syncing user profile:', userUpdateError);
    }
    
    const populatedDoctor = await Doctor.findById(doctor._id)
      .populate('specialtyId', 'name description');
    
    res.json(populatedDoctor);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Error updating doctor profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/doctors/profile - Get doctor profile (doctor only)
router.get('/profile', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Access denied. Doctor only.' });
    }

    const doctor = await Doctor.findById(req.user.id)
      .populate('specialtyId', 'name description');
    
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    res.json(doctor);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// GET /api/doctors/reports - Generate doctor reports (doctor only)
router.get('/reports', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Access denied. Doctor only.' });
    }

    const Appointment = require('../models/Appointment');
    
    // Get all appointments for this doctor
    const appointments = await Appointment.find({ doctorId: req.user.id })
      .populate('specialtyId', 'name')
      .sort({ appointmentDate: -1 });

    // Calculate statistics
    const totalAppointments = appointments.length;
    const confirmedAppointments = appointments.filter(apt => apt.status === 'confirmed').length;
    const completedAppointments = appointments.filter(apt => apt.status === 'completed').length;
    const cancelledAppointments = appointments.filter(apt => apt.status === 'cancelled').length;
    const pendingAppointments = appointments.filter(apt => apt.status === 'pending').length;

    // Monthly stats
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const thisMonthAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate.getMonth() === thisMonth && aptDate.getFullYear() === thisYear;
    });

    // Revenue calculation (assuming completed appointments)
    const doctor = await Doctor.findById(req.user.id);
    const estimatedRevenue = completedAppointments * (doctor?.consultationFee || 0);

    const report = {
      doctorInfo: {
        name: doctor?.name,
        specialty: doctor?.specialty,
        consultationFee: doctor?.consultationFee
      },
      summary: {
        totalAppointments,
        confirmedAppointments,
        completedAppointments,
        cancelledAppointments,
        pendingAppointments,
        thisMonthTotal: thisMonthAppointments.length,
        estimatedRevenue
      },
      recentAppointments: appointments.slice(0, 10),
      generatedAt: new Date()
    };
    
    res.json(report);
  } catch (error) {
    console.error('Error generating doctor reports:', error);
    res.status(500).json({ error: 'Failed to generate reports' });
  }
});

module.exports = router;