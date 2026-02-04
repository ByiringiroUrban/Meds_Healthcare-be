const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Specialty = require('../models/Specialty');
const { authenticate } = require('../middleware/auth');

// Helper: shape a User (role doctor) into a doctor-like object for listing
function userToDoctorShape(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    specialtyId: null,
    specialty: user.specialty || 'General',
    experience: user.experience != null ? user.experience : 0,
    rating: 4.5,
    image: user.avatar || '/placeholder.png',
    qualifications: user.bio ? [user.bio] : [],
    availability: {},
    consultationFee: 50,
    isAvailable: user.isActive !== false,
    isActive: user.isActive !== false,
    source: 'user'
  };
}

// GET /api/doctors - Get all doctors (from Doctor collection + User collection with role doctor)
router.get('/', async (req, res) => {
  try {
    const { specialty } = req.query;

    // 1. All doctors from Doctor collection (include both active and inactive so self-registered show)
    let doctorQuery = {};
    if (specialty) {
      doctorQuery.specialty = specialty;
    }
    const doctorDocs = await Doctor.find(doctorQuery)
      .select('-password')
      .populate('specialtyId', 'name description')
      .sort({ name: 1 })
      .lean();

    const doctorEmails = new Set(doctorDocs.map((d) => d.email.toLowerCase().trim()));

    // 2. All users with role 'doctor' who don't already have a Doctor record
    const userQuery = { role: 'doctor' };
    if (specialty) {
      userQuery.specialty = specialty;
    }
    const doctorUsers = await User.find(userQuery)
      .select('name email specialty experience avatar bio isActive')
      .lean();

    const fromUsers = doctorUsers
      .filter((u) => !doctorEmails.has((u.email || '').toLowerCase().trim()))
      .map((u) => userToDoctorShape(u));

    // Combine and sort by name
    const combined = [...doctorDocs.map((d) => ({ ...d, source: 'doctor' })), ...fromUsers];
    combined.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    res.json(combined);
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

// GET /api/doctors/:id - Get doctor by ID (Doctor collection or User collection)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let doctor = await Doctor.findById(id)
      .populate('specialtyId', 'name description')
      .lean();

    if (doctor) {
      return res.json(doctor);
    }

    // Try User collection (doctor role) so User-only doctors are resolvable
    const user = await User.findOne({ _id: id, role: 'doctor' })
      .select('name email specialty experience avatar bio isActive')
      .lean();
    if (user) {
      return res.json(userToDoctorShape(user));
    }

    return res.status(404).json({ error: 'Doctor not found' });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({ error: 'Failed to fetch doctor' });
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
      image: image || '/placeholder.png',
      qualifications: qualifications || [],
      availability: availability || {},
      consultationFee,
      password
    });

    await doctor.save();

    // Also create corresponding User entry for login access
    try {
      const User = require('../models/User');

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });

      if (!existingUser) {
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
      }
    } catch (userCreationError) {
      console.error('Error creating user entry for doctor:', userCreationError);
      // Don't fail the doctor creation if user entry creation fails
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

    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

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

    // Also update User collection
    try {
      const User = require('../models/User');
      await User.findOneAndUpdate(
        { email: doctor.email },
        {
          name: doctor.name,
          experience: doctor.experience,
          bio: doctor.qualifications ? doctor.qualifications.join(', ') : ''
        }
      );
    } catch (userUpdateError) {
      console.error('Error updating user profile:', userUpdateError);
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