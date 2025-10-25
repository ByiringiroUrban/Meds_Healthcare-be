/**
 * Validation utilities for MEDS Healthcare backend
 */

/**
 * Validate South Sudan phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid
 */
const isValidSudanPhone = (phone) => {
  // South Sudan uses +249 country code followed by 9 digits
  const phoneRegex = /^\+249\d{9}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - { isValid: boolean, message?: string }
 */
const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }
  
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters long' };
  }
  
  // Optional: Add more complex password requirements
  // const hasUpperCase = /[A-Z]/.test(password);
  // const hasLowerCase = /[a-z]/.test(password);
  // const hasNumbers = /\d/.test(password);
  // const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return { isValid: true };
};

/**
 * Validate user registration data
 * @param {object} userData - User data to validate
 * @returns {object} - { isValid: boolean, errors: string[] }
 */
const validateRegistrationData = (userData) => {
  const errors = [];
  const { name, email, phone, password, role, dateOfBirth, specialty, licenseNumber, experience } = userData;

  // Required fields validation
  if (!name || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('Valid email address is required');
  }

  if (!phone || !isValidSudanPhone(phone)) {
    errors.push('Valid South Sudan phone number is required (+249XXXXXXXXX)');
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    errors.push(passwordValidation.message);
  }

  if (!role || !['patient', 'doctor', 'admin'].includes(role)) {
    errors.push('Valid role is required (patient, doctor, or admin)');
  }

  // Role-specific validation
  if (role === 'patient') {
    if (!dateOfBirth) {
      errors.push('Date of birth is required for patients');
    } else {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 0 || age > 150) {
        errors.push('Please enter a valid date of birth');
      }
    }
  }

  if (role === 'doctor') {
    if (!specialty || specialty.trim().length < 2) {
      errors.push('Medical specialty is required for doctors');
    }
    
    if (!licenseNumber || licenseNumber.trim().length < 3) {
      errors.push('Valid medical license number is required for doctors');
    }
    
    if (!experience || experience < 0 || experience > 60) {
      errors.push('Valid years of experience (0-60) is required for doctors');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate login data
 * @param {object} loginData - Login data to validate
 * @returns {object} - { isValid: boolean, errors: string[] }
 */
const validateLoginData = (loginData) => {
  const errors = [];
  const { identifier, password } = loginData;

  if (!identifier) {
    errors.push('Email or phone number is required');
  } else {
    // Check if identifier is either valid email or valid phone
    const isEmail = identifier.includes('@');
    if (isEmail && !isValidEmail(identifier)) {
      errors.push('Invalid email format');
    } else if (!isEmail && !isValidSudanPhone(identifier)) {
      errors.push('Invalid phone number format');
    }
  }

  if (!password) {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  isValidSudanPhone,
  isValidEmail,
  validatePassword,
  validateRegistrationData,
  validateLoginData
};