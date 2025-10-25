const mongoose = require('mongoose');
const Specialty = require('../models/Specialty');
const Category = require('../models/Category');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://wiseacademy:01402@cluster0.bsxehn0.mongodb.net/meds?retryWrites=true&w=majority&appName=Cluster0";

async function syncSpecialtiesToCategories() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get all specialties
    const specialties = await Specialty.find({});
    console.log(`📋 Found ${specialties.length} specialties`);

    // Get all existing categories
    const existingCategories = await Category.find({});
    const existingCategoryNames = existingCategories.map(cat => cat.name);

    let createdCount = 0;

    // For each specialty, create a corresponding category if it doesn't exist
    for (const specialty of specialties) {
      if (!existingCategoryNames.includes(specialty.name)) {
        try {
          const category = new Category({
            name: specialty.name,
            description: `Health awareness content for ${specialty.name}`,
            icon: specialty.icon || 'stethoscope'
          });
          await category.save();
          console.log(`✅ Created category: ${specialty.name}`);
          createdCount++;
        } catch (error) {
          console.log(`⚠️ Error creating category for ${specialty.name}:`, error.message);
        }
      } else {
        console.log(`ℹ️ Category already exists: ${specialty.name}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - Specialties found: ${specialties.length}`);
    console.log(`   - New categories created: ${createdCount}`);
    console.log(`   - Total categories now: ${await Category.countDocuments()}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error syncing specialties to categories:", error);
    process.exit(1);
  }
}

syncSpecialtiesToCategories();
