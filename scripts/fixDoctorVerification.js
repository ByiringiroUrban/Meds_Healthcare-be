const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');

/**
 * Script to fix doctor verification issues
 * This will ensure all doctors can login after admin verification
 */
async function fixDoctorVerification() {
  try {
    console.log('🔧 Starting doctor verification fix...');

    // 1. Find all doctors in Doctor collection that are active but corresponding User is not verified
    const activeDoctors = await Doctor.find({ 
      $or: [
        { isActive: true },
        { isAvailable: true }
      ]
    });

    console.log(`📋 Found ${activeDoctors.length} active doctors`);

    for (const doctor of activeDoctors) {
      // Find corresponding user
      const user = await User.findOne({ email: doctor.email });
      
      if (user) {
        if (!user.verified || !user.isActive) {
          console.log(`✅ Fixing verification for doctor: ${doctor.email}`);
          
          // Update user to be verified and active
          await User.findOneAndUpdate(
            { email: doctor.email },
            { 
              verified: true,
              isActive: true 
            }
          );
          
          console.log(`   ✅ Updated User record for ${doctor.email}`);
        } else {
          console.log(`   ✅ Doctor ${doctor.email} already verified`);
        }
      } else {
        console.log(`   ⚠️  No User record found for doctor: ${doctor.email}`);
      }
    }

    // 2. Find all admin-created doctors and ensure they're verified
    const adminCreatedDoctors = await User.find({ 
      role: 'doctor',
      verified: true // These should be admin-created
    });

    console.log(`📋 Found ${adminCreatedDoctors.length} admin-created doctors`);

    for (const user of adminCreatedDoctors) {
      // Ensure corresponding Doctor record exists and is active
      const doctorRecord = await Doctor.findOne({ email: user.email });
      
      if (doctorRecord) {
        if (!doctorRecord.isActive || !doctorRecord.isAvailable) {
          console.log(`✅ Activating doctor record for: ${user.email}`);
          
          await Doctor.findOneAndUpdate(
            { email: user.email },
            { 
              isActive: true,
              isAvailable: true 
            }
          );
          
          console.log(`   ✅ Updated Doctor record for ${user.email}`);
        }
      } else {
        console.log(`   ⚠️  No Doctor record found for user: ${user.email}`);
      }
    }

    // 3. Check for any doctors with mismatched verification status
    const allDoctorUsers = await User.find({ role: 'doctor' });
    console.log(`📋 Checking verification status for ${allDoctorUsers.length} doctor users`);

    for (const user of allDoctorUsers) {
      const doctorRecord = await Doctor.findOne({ email: user.email });
      
      if (doctorRecord) {
        const userVerified = user.verified && user.isActive;
        const doctorActive = doctorRecord.isActive && doctorRecord.isAvailable;
        
        if (userVerified !== doctorActive) {
          console.log(`🔄 Syncing verification status for: ${user.email}`);
          console.log(`   User: verified=${user.verified}, active=${user.isActive}`);
          console.log(`   Doctor: active=${doctorRecord.isActive}, available=${doctorRecord.isAvailable}`);
          
          if (userVerified) {
            // User is verified, make doctor active
            await Doctor.findOneAndUpdate(
              { email: user.email },
              { 
                isActive: true,
                isAvailable: true 
              }
            );
            console.log(`   ✅ Activated doctor record`);
          } else {
            // Doctor is active but user isn't verified, verify user
            await User.findOneAndUpdate(
              { email: user.email },
              { 
                verified: true,
                isActive: true 
              }
            );
            console.log(`   ✅ Verified user record`);
          }
        }
      }
    }

    console.log('🎉 Doctor verification fix completed successfully!');
    
    // Summary
    const verifiedDoctors = await User.countDocuments({ 
      role: 'doctor', 
      verified: true, 
      isActive: true 
    });
    
    const activeDoctorRecords = await Doctor.countDocuments({ 
      isActive: true, 
      isAvailable: true 
    });
    
    console.log(`📊 Summary:`);
    console.log(`   Verified doctor users: ${verifiedDoctors}`);
    console.log(`   Active doctor records: ${activeDoctorRecords}`);
    
  } catch (error) {
    console.error('❌ Error fixing doctor verification:', error);
    throw error;
  }
}

module.exports = { fixDoctorVerification };

// Run the script if called directly
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital-management')
    .then(() => {
      console.log('📡 Connected to MongoDB');
      return fixDoctorVerification();
    })
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}