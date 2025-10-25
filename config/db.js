const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/meds-healthcare';
    await mongoose.connect(mongoURI, {
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.log('Please make sure MongoDB is running on your system');
    console.log('You can start MongoDB with: mongod');
    process.exit(1);
  }
};

module.exports = connectDB;
