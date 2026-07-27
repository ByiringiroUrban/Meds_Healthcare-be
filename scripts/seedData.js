const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Stats = require('../models/Stats');
const Specialty = require('../models/Specialty');
const Doctor = require('../models/Doctor');
const User = require('../models/User');

const seedData = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGO_URI is not defined in environment');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    console.log('Seeding initial data...');

    // Clear existing data in Doctor, Specialty, and Stats
    await Stats.deleteMany({});
    await Specialty.deleteMany({});
    await Doctor.deleteMany({});
    // Remove doctor users from User collection to re-seed cleanly
    await User.deleteMany({ role: 'doctor' });

    // 1. Create Stats
    const stats = new Stats({
      expertDoctors: 25,
      happyPatients: 1200,
      medicalDepartments: 8,
      emergencySupport: '24/7'
    });
    await stats.save();

    // 2. Create Specialties
    const specialties = await Specialty.insertMany([
      {
        name: 'General Medicine',
        description: 'Primary healthcare and general medical wellness',
        icon: '🩺'
      },
      {
        name: 'Cardiology',
        description: 'Heart, blood vessels and cardiovascular care',
        icon: '❤️'
      },
      {
        name: 'Pediatrics',
        description: 'Medical care for infants, children, and adolescents',
        icon: '👶'
      },
      {
        name: 'Orthopedics',
        description: 'Bone, joint, and musculoskeletal system treatment',
        icon: '🦴'
      },
      {
        name: 'Dermatology',
        description: 'Skin, hair, and nail health and care',
        icon: '✨'
      },
      {
        name: 'Gynecology',
        description: 'Women’s reproductive health and maternity care',
        icon: '🌸'
      },
      {
        name: 'Neurology',
        description: 'Brain, spinal cord and nervous system care',
        icon: '🧠'
      }
    ]);

    // 3. Create Doctors & Doctor Users
    const defaultPassword = 'Password123!';
    const hashedPass = await bcrypt.hash(defaultPassword, 12);

    const initialDoctors = [
      {
        name: 'Dr. Fatima Deng',
        email: 'fatima.deng@medshealthcare.com',
        phone: '+249912345601',
        specialtyName: 'General Medicine',
        experience: 12,
        rating: 4.9,
        image: 'https://img.freepik.com/premium-vector/default-placeholder-doctor-portrait-photo-avatar-gray-background-greyscale_885953-619.jpg?w=360',
        qualifications: ['MBBS', 'MD (Internal Medicine)'],
        consultationFee: 50,
        address: 'Atlabara, Juba',
        licenseNumber: 'LIC-SS-1001',
        bio: 'Senior General Physician with over 12 years of experience providing comprehensive family care in Juba.'
      },
      {
        name: 'Dr. Taban Emmanuel',
        email: 'taban.emmanuel@medshealthcare.com',
        phone: '+249912345602',
        specialtyName: 'Cardiology',
        experience: 15,
        rating: 4.8,
        image: 'https://img.freepik.com/premium-vector/vector-medical-icon-doctor-image-doctor-with-stethoscope-illustration-medic-doctor-avatar_885953-806.jpg',
        qualifications: ['MBBS', 'MSc Cardiology', 'FACC'],
        consultationFee: 80,
        address: 'Tongpiny, Juba',
        licenseNumber: 'LIC-SS-1002',
        bio: 'Consultant Cardiologist specializing in heart disease prevention and cardiac wellness.'
      },
      {
        name: 'Dr. Sara Kiden',
        email: 'sara.kiden@medshealthcare.com',
        phone: '+249912345603',
        specialtyName: 'Pediatrics',
        experience: 9,
        rating: 4.9,
        image: 'https://img.freepik.com/premium-vector/default-placeholder-doctor-portrait-photo-avatar-gray-background-greyscale_885953-619.jpg?w=360',
        qualifications: ['MBBS', 'DCH (Pediatrics)'],
        consultationFee: 45,
        address: 'Hai Neem, Juba',
        licenseNumber: 'LIC-SS-1003',
        bio: 'Passionate pediatrician dedicated to child health, vaccinations, and developmental care.'
      },
      {
        name: 'Dr. Joseph Lado',
        email: 'joseph.lado@medshealthcare.com',
        phone: '+249912345604',
        specialtyName: 'Orthopedics',
        experience: 14,
        rating: 4.7,
        image: 'https://img.freepik.com/premium-vector/vector-medical-icon-doctor-image-doctor-with-stethoscope-illustration-medic-doctor-avatar_885953-806.jpg',
        qualifications: ['MBBS', 'MS (Orthopedics)'],
        consultationFee: 70,
        address: 'Munuki, Juba',
        licenseNumber: 'LIC-SS-1004',
        bio: 'Orthopedic surgeon specializing in bone fracture repair, joint pain management, and sports medicine.'
      },
      {
        name: 'Dr. Aisha Bol',
        email: 'aisha.bol@medshealthcare.com',
        phone: '+249912345605',
        specialtyName: 'Gynecology',
        experience: 11,
        rating: 4.9,
        image: 'https://img.freepik.com/premium-vector/default-placeholder-doctor-portrait-photo-avatar-gray-background-greyscale_885953-619.jpg?w=360',
        qualifications: ['MBBS', 'MD (Obstetrics & Gynecology)'],
        consultationFee: 65,
        address: 'Gudele, Juba',
        licenseNumber: 'LIC-SS-1005',
        bio: 'Experienced Obstetrician & Gynecologist delivering personalized care for women.'
      },
      {
        name: 'Dr. Peter Majok',
        email: 'peter.majok@medshealthcare.com',
        phone: '+249912345606',
        specialtyName: 'Dermatology',
        experience: 8,
        rating: 4.6,
        image: 'https://img.freepik.com/premium-vector/vector-medical-icon-doctor-image-doctor-with-stethoscope-illustration-medic-doctor-avatar_885953-806.jpg',
        qualifications: ['MBBS', 'Diploma in Dermatology'],
        consultationFee: 55,
        address: 'Juba Na Bari, Juba',
        licenseNumber: 'LIC-SS-1006',
        bio: 'Dermatologist treating skin allergies, infections, acne, and cosmetic dermatological conditions.'
      }
    ];

    for (const docData of initialDoctors) {
      const spec = specialties.find(s => s.name === docData.specialtyName) || specialties[0];

      // Save Doctor document
      const doc = new Doctor({
        name: docData.name,
        email: docData.email,
        specialtyId: spec._id,
        specialty: spec.name,
        experience: docData.experience,
        rating: docData.rating,
        image: docData.image,
        qualifications: docData.qualifications,
        availability: {
          monday: ['09:00 AM - 01:00 PM', '04:00 PM - 08:00 PM'],
          tuesday: ['09:00 AM - 01:00 PM', '04:00 PM - 08:00 PM'],
          wednesday: ['09:00 AM - 01:00 PM'],
          thursday: ['09:00 AM - 01:00 PM', '04:00 PM - 08:00 PM'],
          friday: ['09:00 AM - 01:00 PM']
        },
        password: defaultPassword,
        consultationFee: docData.consultationFee,
        isAvailable: true,
        isActive: true,
        address: docData.address
      });
      await doc.save();

      // Save User document with role 'doctor'
      const userDoc = new User({
        name: docData.name,
        email: docData.email,
        phone: docData.phone,
        password: defaultPassword,
        role: 'doctor',
        specialty: spec.name,
        licenseNumber: docData.licenseNumber,
        experience: docData.experience,
        bio: docData.bio,
        avatar: docData.image,
        verified: true,
        isActive: true,
        isEmailVerified: true
      });
      await userDoc.save();
    }

    console.log('✅ Data seeded successfully!');
    console.log(`📊 Created ${specialties.length} specialties`);
    console.log(`👨‍⚕️ Created ${initialDoctors.length} doctors and doctor user accounts`);
    console.log('📈 Created stats');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedData();