const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'acknowledged', 'in_progress', 'resolved', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'high'
  },
  // Location information
  location: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      default: 'Location not available'
    },
    accuracy: {
      type: Number
    }
  },
  // Symptoms selected by patient
  symptoms: [{
    type: String,
    enum: [
      'Chest Pain',
      'Difficulty Breathing',
      'Severe Bleeding',
      'Unconscious',
      'Severe Headache',
      'Allergic Reaction',
      'Heart Attack',
      'Stroke',
      'Accident/Injury',
      'Other Emergency'
    ]
  }],
  // Voice message
  voiceMessage: {
    url: {
      type: String
    },
    duration: {
      type: Number // in seconds
    }
  },
  // Additional notes
  notes: {
    type: String,
    trim: true
  },
  // Assigned hospital/clinic/doctor
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Can be doctor or admin
    default: null
  },
  // Response information
  response: {
    acknowledgedAt: {
      type: Date
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: {
      type: String
    }
  },
  // Call information
  callInitiated: {
    type: Boolean,
    default: false
  },
  callConnected: {
    type: Boolean,
    default: false
  },
  // Notification tracking
  notificationsSent: {
    hospitals: {
      type: Boolean,
      default: false
    },
    clinics: {
      type: Boolean,
      default: false
    },
    doctors: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
emergencySchema.index({ patientId: 1, createdAt: -1 });
emergencySchema.index({ status: 1, createdAt: -1 });
emergencySchema.index({ assignedTo: 1, status: 1 });
emergencySchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

// Virtual for calculating distance (can be used for finding nearest hospitals)
emergencySchema.virtual('locationPoint').get(function() {
  return {
    type: 'Point',
    coordinates: [this.location.longitude, this.location.latitude]
  };
});

module.exports = mongoose.model('Emergency', emergencySchema);

