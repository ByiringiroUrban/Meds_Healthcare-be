const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Stats = require('../models/Stats');
const Specialty = require('../models/Specialty');
const Doctor = require('../models/Doctor');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb+srv://root:12345@cluster-1.agg1j.mongodb.net/medis-health?retryWrites=true&w=majority&appName=Cluster-1');

    console.log('Seeding data...');

    // Clear existing data
    await Stats.deleteMany({});
    await Specialty.deleteMany({});
    await Doctor.deleteMany({});

    // Create stats
    const stats = new Stats({
      expertDoctors: 50,
      happyPatients: 1000,
      medicalDepartments: 15,
      emergencySupport: '24/7'
    });
    await stats.save();

    // Create specialties
    const specialties = await Specialty.insertMany([
      {
        name: 'Cardiology',
        description: 'Heart and cardiovascular system care',
        icon: 'heart'
      },
      {
        name: 'Neurology',
        description: 'Brain and nervous system treatment',
        icon: 'brain'
      },
      {
        name: 'Pediatrics',
        description: 'Medical care for children and infants',
        icon: 'baby'
      },
      {
        name: 'Orthopedics',
        description: 'Bone, joint, and muscle treatment',
        icon: 'bone'
      },
      {
        name: 'Dermatology',
        description: 'Skin, hair, and nail care',
        icon: 'user'
      },
      {
        name: 'General Medicine',
        description: 'Primary healthcare and general wellness',
        icon: 'stethoscope'
      }
    ]);

    // Create doctors
    const doctors = [
      {
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@medshealthcare.com',
        specialtyId: specialties[0]._id,
        specialty: 'Cardiology',
        experience: 15,
        rating: 4.8,
        image: '/placeholder.png',
        qualifications: ['MD Cardiology', 'FACC'],
        consultationFee: 150
      },
      {
        name: 'Dr. Michael Chen',
        email: 'michael.chen@medshealthcare.com',
        specialtyId: specialties[1]._id,
        specialty: 'Neurology',
        experience: 12,
        rating: 4.9,
        image: '/placeholder.png',
        qualifications: ['MD Neurology', 'PhD'],
        consultationFee: 180
      },
      {
        name: 'Dr. Emily Davis',
        email: 'emily.davis@medshealthcare.com',
        specialtyId: specialties[2]._id,
        specialty: 'Pediatrics',
        experience: 8,
        rating: 4.7,
        image: '/placeholder.png',
        qualifications: ['MD Pediatrics', 'AAP'],
        consultationFee: 120
      },
      {
        name: 'Dr. James Wilson',
        email: 'james.wilson@medshealthcare.com',
        specialtyId: specialties[3]._id,
        specialty: 'Orthopedics',
        experience: 20,
        rating: 4.6,
        image: '/placeholder.png',
        qualifications: ['MD Orthopedics', 'AAOS'],
        consultationFee: 160
      },
      {
        name: 'Dr. Lisa Rodriguez',
        email: 'lisa.rodriguez@medshealthcare.com',
        specialtyId: specialties[4]._id,
        specialty: 'Dermatology',
        experience: 10,
        rating: 4.8,
        image: '/placeholder.png',
        qualifications: ['MD Dermatology', 'AAD'],
        consultationFee: 140
      },
      {
        name: 'Dr. Robert Brown',
        email: 'robert.brown@medshealthcare.com',
        specialtyId: specialties[5]._id,
        specialty: 'General Medicine',
        experience: 18,
        rating: 4.5,
        image: '/placeholder.png',
        qualifications: ['MD Internal Medicine', 'ABIM'],
        consultationFee: 100
      }
    ];

    await Doctor.insertMany(doctors);

    console.log('✅ Data seeded successfully!');
    console.log(`📊 Created ${specialties.length} specialties`);
    console.log(`👨‍⚕️ Created ${doctors.length} doctors`);
    console.log('📈 Created stats');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedData();