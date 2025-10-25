const mongoose = require('mongoose');
const Category = require('../models/Category');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://wiseacademy:01402@cluster0.bsxehn0.mongodb.net/meds?retryWrites=true&w=majority&appName=Cluster0";

async function createHealthCategories() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Health awareness categories for South Sudan
    const healthCategories = [
      {
        name: "Malaria Prevention",
        description: "Health awareness content for malaria prevention and treatment",
        icon: "🦟"
      },
      {
        name: "Nutrition & Diet",
        description: "Healthy eating and nutrition guidance for families",
        icon: "🥗"
      },
      {
        name: "Maternal Health",
        description: "Pregnancy care and maternal health awareness",
        icon: "🤱"
      },
      {
        name: "Child Health",
        description: "Pediatric care and child health development",
        icon: "👶"
      },
      {
        name: "Hygiene & Sanitation",
        description: "Personal hygiene and community sanitation practices",
        icon: "🧼"
      },
      {
        name: "Emergency First Aid",
        description: "Basic first aid and emergency response training",
        icon: "🚑"
      },
      {
        name: "Mental Health",
        description: "Mental wellness and psychological support",
        icon: "🧠"
      },
      {
        name: "Infectious Diseases",
        description: "Prevention and awareness of infectious diseases",
        icon: "🦠"
      },
      {
        name: "Water Safety",
        description: "Clean water access and waterborne disease prevention",
        icon: "💧"
      },
      {
        name: "Vaccination",
        description: "Immunization schedules and vaccine awareness",
        icon: "💉"
      }
    ];

    // Check which categories already exist
    const existingCategories = await Category.find({});
    const existingNames = existingCategories.map(cat => cat.name);

    // Create only new categories
    const newCategories = healthCategories.filter(cat => !existingNames.includes(cat.name));

    if (newCategories.length > 0) {
      await Category.insertMany(newCategories);
      console.log(`✅ Created ${newCategories.length} new health awareness categories:`);
      newCategories.forEach(cat => console.log(`   - ${cat.name}`));
    } else {
      console.log("ℹ️ All health categories already exist");
    }

    // Show all categories
    const allCategories = await Category.find({}).sort({ name: 1 });
    console.log(`\n📋 Total categories available: ${allCategories.length}`);
    allCategories.forEach(cat => console.log(`   - ${cat.name}`));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating health categories:", error);
    process.exit(1);
  }
}

createHealthCategories();
