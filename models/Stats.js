const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
  expertDoctors: {
    type: Number,
    required: true,
    default: 0
  },
  happyPatients: {
    type: Number,
    required: true,
    default: 0
  },
  medicalDepartments: {
    type: Number,
    required: true,
    default: 0
  },
  emergencySupport: {
    type: String,
    required: true,
    default: '24/7'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Stats', statsSchema);