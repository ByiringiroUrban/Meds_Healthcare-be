// seed.js 
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Models
import User from "./models/User.js";
import Doctor from "./models/Doctor.js";
import Specialty from "./models/Specialty.js";
import Appointment from "./models/Appointment.js";
import Blog from "./models/Blog.js";
import Category from "./models/Category.js";
import Course from "./models/Course.js";
import Activity from "./models/Activity.js";
import ChatRoom from "./models/ChatRoom.js";
import ChatMessage from "./models/ChatMessage.js";
import Stats from "./models/Stats.js";
import Testimonial from "./models/Testimonial.js";

const MONGO_URI = "mongodb+srv://wiseacademy:01402@cluster0.bsxehn0.mongodb.net/meds?retryWrites=true&w=majority&appName=Cluster0"; 

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear all collections
    await Promise.all([
      User.deleteMany({}),
      Doctor.deleteMany({}),
      Specialty.deleteMany({}),
      Appointment.deleteMany({}),
      Blog.deleteMany({}),
      Category.deleteMany({}),
      Course.deleteMany({}),
      Activity.deleteMany({}),
      ChatRoom.deleteMany({}),
      ChatMessage.deleteMany({}),
      Stats.deleteMany({}),
      Testimonial.deleteMany({}),
    ]);
    console.log("🧹 Old data cleared");

    const defaultPassword = "Password123!";
    const hashedPass = await bcrypt.hash(defaultPassword, 12);

    // Sudan-specific specialties
    const specialties = await Specialty.insertMany([
      { name: "General Medicine", description: "Basic healthcare and checkups", icon: "🩺" },
      { name: "Pediatrics", description: "Child healthcare services", icon: "👶" },
      { name: "Cardiology", description: "Heart and cardiovascular care", icon: "❤️" },
      { name: "Gynecology", description: "Women’s reproductive health", icon: "🌸" },
      { name: "Orthopedics", description: "Bone and joint care", icon: "🦴" },
    ]);

    // Sudan-specific categories
    const categories = await Category.insertMany([
      { name: "Health Awareness", description: "Community health campaigns", icon: "📢" },
      { name: "Medical Education", description: "Courses for students and doctors", icon: "📚" },
      { name: "Nutrition", description: "Food and healthy lifestyle tips", icon: "🥗" },
      { name: "Mental Health", description: "Awareness and support for mental wellness", icon: "🧠" },
      { name: "Emergency Care", description: "First aid and urgent care guides", icon: "🚑" },
    ]);

    // Users: 1 admin, 5 patients, 5 doctors
    const users = [
      {
        name: "Admin User",
        email: "admin@example.com",
        phone: "+249911111111",
        password: hashedPass,
        role: "admin",
      },
      ...Array.from({ length: 5 }).map((_, i) => ({
        name: `Patient ${i + 1}`,
        email: `patient${i + 1}@example.com`,
        phone: `+24992233${1000 + i}`,
        password: hashedPass,
        role: "patient",
        dateOfBirth: new Date(1985 + i, 5, 15),
      })),
      ...Array.from({ length: 5 }).map((_, i) => ({
        name: `Dr. ${["Ahmed", "Fatima", "Mohamed", "Sara", "Omar"][i]}`,
        email: `doctor${i + 1}@example.com`,
        phone: `+24993344${1000 + i}`,
        password: hashedPass,
        role: "doctor",
        specialty: specialties[i % specialties.length].name,
        licenseNumber: `LIC${1000 + i}`,
        experience: 5 + i,
      })),
    ];

    const savedUsers = await User.insertMany(users);

    // Doctors collection
    const doctors = await Doctor.insertMany(
      savedUsers
        .filter((u) => u.role === "doctor")
        .map((d, i) => ({
          name: d.name,
          email: d.email,
          specialtyId: specialties[i % specialties.length]._id,
          specialty: specialties[i % specialties.length].name,
          role: "doctor",
          experience: d.experience,
          consultationFee: 100 + i * 20,
          password: hashedPass,
          qualifications: ["MBBS", "MD"],
        }))
    );

    // Appointments
    await Appointment.insertMany(
      Array.from({ length: 10 }).map((_, i) => ({
        patientName: savedUsers[1 + (i % 5)].name,
        patientEmail: savedUsers[1 + (i % 5)].email,
        patientPhone: savedUsers[1 + (i % 5)].phone,
        doctorId: doctors[i % doctors.length]._id,
        specialtyId: doctors[i % doctors.length].specialtyId,
        appointmentDate: new Date(2025, 8, 10 + i),
        appointmentTime: "10:00 AM",
        status: ["pending", "confirmed", "completed", "cancelled"][i % 4],
      }))
    );

    // Blogs
    await Blog.insertMany(
      Array.from({ length: 5 }).map((_, i) => ({
        title: `Health Blog ${i + 1}`,
        excerpt: `This is a short health tip from Sudan - post ${i + 1}`,
        content: `Detailed health content for awareness in Sudan - article ${i + 1}.`,
        author: savedUsers[0].name,
        authorId: savedUsers[0]._id,
        category: categories[i % categories.length].name,
        tags: ["health", "Sudan"],
        views: 50 + i,
        likes: 10 + i,
      }))
    );

    // Courses
    await Course.insertMany(
      Array.from({ length: 5 }).map((_, i) => ({
        title: `Course ${i + 1} on Healthcare`,
        summary: "Introductory medical course for Sudanese students.",
        content: "Course materials and lessons.",
        categoryId: categories[i % categories.length]._id,
        category: categories[i % categories.length].name,
        views: 20 + i,
      }))
    );

    // Activities
    await Activity.insertMany(
      Array.from({ length: 5 }).map((_, i) => ({
        title: "User Activity",
        description: `Activity log ${i + 1}`,
        type: ["user_registration", "appointment_booking", "system_update"][i % 3],
        userId: savedUsers[i % savedUsers.length]._id,
      }))
    );

    // ChatRooms + Messages
    for (let i = 0; i < 3; i++) {
      const room = await ChatRoom.create({
        participants: [savedUsers[1]._id, doctors[i % doctors.length]._id],
      });
      await ChatMessage.insertMany([
        {
          senderId: savedUsers[1]._id,
          receiverId: doctors[i % doctors.length]._id,
          content: "Hello Doctor, I need advice.",
          roomId: room._id.toString(),
        },
        {
          senderId: doctors[i % doctors.length]._id,
          receiverId: savedUsers[1]._id,
          content: "Sure, please share your symptoms.",
          roomId: room._id.toString(),
        },
      ]);
    }

    // Stats
    await Stats.create({
      expertDoctors: doctors.length,
      happyPatients: 200,
      medicalDepartments: specialties.length,
      emergencySupport: "24/7",
    });

    // Testimonials
    await Testimonial.insertMany(
      Array.from({ length: 5 }).map((_, i) => ({
        patientName: savedUsers[1 + (i % 5)].name,
        patientEmail: savedUsers[1 + (i % 5)].email,
        content: `The doctor provided excellent care - testimonial ${i + 1}.`,
        rating: 4,
        treatment: specialties[i % specialties.length].name,
        isApproved: true,
      }))
    );

    console.log("🌱 Database seeded successfully!\n");

    // Credentials
    console.log("🔑 Test Credentials:");
    console.log("Admin:    admin@example.com | Password123!");
    savedUsers
      .filter((u) => u.role === "doctor")
      .forEach((d, i) =>
        console.log(`Doctor${i + 1}: ${d.email} ${d.phone} | Password123!`)
      );
    savedUsers
      .filter((u) => u.role === "patient")
      .forEach((p, i) =>
        console.log(`Patient${i + 1}: ${p.email} ${p.phone} | Password123!`)
      );

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding database:", err);
    process.exit(1);
  }
}

seed();
