const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Specialty = require('../models/Specialty');
const { authenticate } = require('../middleware/auth');
const nodemailer = require('nodemailer');

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'byiringirourban20@gmail.com',
    pass: 'zljw hslg rxpb mqpu'
  }
});

// GET /api/appointments - Get all appointments (admin only)
router.get('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    const appointments = await Appointment.find()
      .populate('doctorId', 'name specialty')
      .populate('specialtyId', 'name')
      .sort({ createdAt: -1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/user - Get user's appointments
router.get('/user', authenticate, async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientEmail: req.user.email })
      .populate('doctorId', 'name specialty')
      .populate('specialtyId', 'name')
      .sort({ appointmentDate: 1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching user appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/doctor - Get doctor's appointments
router.get('/doctor', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Access denied. Doctor only.' });
    }

    const appointments = await Appointment.find({ doctorId: req.user.id })
      .populate('doctorId', 'name specialty')
      .populate('specialtyId', 'name')
      .sort({ appointmentDate: 1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// POST /api/appointments - Create new appointment
router.post('/', async (req, res) => {
  try {
    const { 
      patientName, 
      patientEmail, 
      patientPhone, 
      doctorId, 
      specialtyId,
      appointmentDate,
      appointmentTime,
      notes 
    } = req.body;
    
    if (!patientName || !patientEmail || !patientPhone || !doctorId || !specialtyId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ 
        error: 'All required fields must be provided' 
      });
    }

    // Get doctor and specialty details for email
    const doctor = await Doctor.findById(doctorId);
    const specialty = await Specialty.findById(specialtyId);
    
    if (!doctor || !specialty) {
      return res.status(400).json({ error: 'Invalid doctor or specialty' });
    }

    const appointment = new Appointment({
      patientName,
      patientEmail,
      patientPhone,
      doctorId,
      specialtyId,
      appointmentDate,
      appointmentTime,
      notes: notes || ''
    });

    await appointment.save();
    
    // Send confirmation email
    const mailOptions = {
      from: 'byiringirourban20@gmail.com',
      to: patientEmail,
      subject: 'Appointment Confirmation - MEDS Healthcare',
      html: `
        <h2>Appointment Confirmation</h2>
        <p>Dear ${patientName},</p>
        <p>Your appointment has been successfully booked. Here are the details:</p>
        <ul>
          <li><strong>Doctor:</strong> ${doctor.name}</li>
          <li><strong>Specialty:</strong> ${specialty.name}</li>
          <li><strong>Date:</strong> ${new Date(appointmentDate).toLocaleDateString()}</li>
          <li><strong>Time:</strong> ${appointmentTime}</li>
          <li><strong>Phone:</strong> ${patientPhone}</li>
        </ul>
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        <p>Please arrive 15 minutes before your scheduled appointment time.</p>
        <p>Thank you for choosing MEDS Healthcare!</p>
      `
    };

    await transporter.sendMail(mailOptions);
    
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctorId', 'name specialty')
      .populate('specialtyId', 'name');
    
    res.status(201).json(populatedAppointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// PUT /api/appointments/:id - Update appointment status (admin and doctor can update)
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Allow both admin and doctors to update appointments
    if (req.user.role !== 'admin' && req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Access denied. Admin or Doctor only.' });
    }

    const { status, notes } = req.body;
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctorId', 'name specialty')
      .populate('specialtyId', 'name');
      
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // If user is doctor, ensure they can only update their own appointments
    if (req.user.role === 'doctor' && appointment.doctorId._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You can only update your own appointments.' });
    }

    const oldStatus = appointment.status;
    if (status !== undefined) appointment.status = status;
    if (notes !== undefined) appointment.notes = notes;

    await appointment.save();
    
    // Send email notification when status changes to confirmed
    if (status === 'confirmed' && oldStatus !== 'confirmed') {
      const mailOptions = {
        from: 'byiringirourban20@gmail.com',
        to: appointment.patientEmail,
        subject: 'Appointment Confirmed - MEDS Healthcare',
        html: `
          <h2>🎉 Your Appointment Has Been Confirmed!</h2>
          <p>Dear ${appointment.patientName},</p>
          <p>Great news! Your appointment has been approved and confirmed.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📅 Appointment Details:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>👨‍⚕️ Doctor:</strong> ${appointment.doctorId.name}</li>
              <li><strong>🏥 Specialty:</strong> ${appointment.specialtyId.name}</li>
              <li><strong>📅 Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()}</li>
              <li><strong>⏰ Time:</strong> ${appointment.appointmentTime}</li>
              <li><strong>📞 Phone:</strong> ${appointment.patientPhone}</li>
            </ul>
          </div>
          
          ${appointment.notes ? `<p><strong>📝 Additional Notes:</strong> ${appointment.notes}</p>` : ''}
          
          <p><strong>⚠️ Important Reminders:</strong></p>
          <ul>
            <li>Please arrive 15 minutes before your scheduled time</li>
            <li>Bring a valid ID and insurance card</li>
            <li>If you need to reschedule, please contact us at least 24 hours in advance</li>
          </ul>
          
          <p>We look forward to seeing you!</p>
          <p>Best regards,<br/>MEDS Healthcare Team</p>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log('Confirmation email sent successfully');
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }

    // Send rejection email when status changes to cancelled
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      const mailOptions = {
        from: 'byiringirourban20@gmail.com',
        to: appointment.patientEmail,
        subject: 'Appointment Update - MEDS Healthcare',
        html: `
          <h2>Appointment Status Update</h2>
          <p>Dear ${appointment.patientName},</p>
          <p>We regret to inform you that your appointment scheduled for ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime} has been cancelled.</p>
          
          <p>Please contact us to reschedule your appointment:</p>
          <ul>
            <li>📞 Phone: +1-234-567-8900</li>
            <li>📧 Email: info@medshealthcare.com</li>
          </ul>
          
          <p>We apologize for any inconvenience.</p>
          <p>Best regards,<br/>MEDS Healthcare Team</p>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log('Cancellation email sent successfully');
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError);
      }
    }
    
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctorId', 'name specialty')
      .populate('specialtyId', 'name');
    
    res.json(populatedAppointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// DELETE /api/appointments/:id - Cancel appointment (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

module.exports = router;
