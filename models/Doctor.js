
const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");

const DoctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    specialtyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Specialty",
      required: true,
    },
    specialty: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: [, "doctor", ],
      default: "doctor",
    },
    experience: {
      type: Number,
      required: [true, "Experience is required"],
      min: 0,
    },
    rating: {
      type: Number,
      default: 4.5,
      min: 1,
      max: 5,
    },
    image: {
      type: String,
      default: "/placeholder.svg",
    },
    qualifications: [
      {
        type: String,
        trim: true,
      },
    ],
    availability: {
      type: Object,
      default: {},
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    consultationFee: {
      type: Number,
      required: [true, "Consultation fee is required"],
      min: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);
DoctorSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
DoctorSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get user object without password
DoctorSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('Doctor', DoctorSchema);
