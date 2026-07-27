const nodemailer = require('nodemailer');

// Create transporter
const createTransport = () => {
  const emailUser = process.env.EMAIL_USER || process.env.EMAIL_ADDRESS;
  let emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || process.env.EMAIL_APP_PASSWORD;

  // Check if email credentials are configured
  if (!emailUser || !emailPass) {
    console.warn('⚠️  Email credentials not configured. Email sending will be disabled.');
    console.warn('💡 To enable email sending, set EMAIL_USER and EMAIL_PASS in your .env file');
    return null;
  }

  // Remove all spaces from App Password (e.g., "txwy ywhl avow hbcr" -> "txwyywhlavowhbcr")
  emailPass = emailPass.replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser.trim(),
      pass: emailPass.trim()
    }
  });
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create beautiful HTML email template for OTP verification
const createOTPEmailTemplate = (userName, otp) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - Meds Healthcare</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8fafc;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            }
            .header {
                background: linear-gradient(135deg, #f43f5e 0%, #14b8a6 100%);
                padding: 40px 30px;
                text-align: center;
                color: white;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 700;
            }
            .header p {
                margin: 10px 0 0 0;
                font-size: 16px;
                opacity: 0.9;
            }
            .content {
                padding: 40px 30px;
            }
            .greeting {
                font-size: 18px;
                color: #1f2937;
                margin-bottom: 20px;
            }
            .message {
                font-size: 16px;
                color: #4b5563;
                margin-bottom: 30px;
                line-height: 1.7;
            }
            .otp-container {
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                border: 2px dashed #cbd5e1;
                border-radius: 12px;
                padding: 30px;
                text-align: center;
                margin: 30px 0;
            }
            .otp-label {
                font-size: 14px;
                color: #64748b;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-weight: 600;
            }
            .otp-code {
                font-size: 36px;
                font-weight: 700;
                color: #1e293b;
                letter-spacing: 8px;
                margin: 10px 0;
                font-family: 'Courier New', monospace;
                background: linear-gradient(135deg, #f43f5e, #14b8a6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .otp-note {
                font-size: 14px;
                color: #64748b;
                margin-top: 15px;
            }
            .instructions {
                background-color: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 20px;
                margin: 30px 0;
                border-radius: 0 8px 8px 0;
            }
            .instructions h3 {
                margin: 0 0 10px 0;
                color: #92400e;
                font-size: 16px;
            }
            .instructions ul {
                margin: 0;
                padding-left: 20px;
                color: #92400e;
            }
            .instructions li {
                margin-bottom: 5px;
            }
            .footer {
                background-color: #f8fafc;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
            }
            .footer p {
                margin: 0;
                color: #64748b;
                font-size: 14px;
            }
            .footer a {
                color: #f43f5e;
                text-decoration: none;
            }
            .security-note {
                background-color: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
            }
            .security-note p {
                margin: 0;
                color: #dc2626;
                font-size: 14px;
                font-weight: 500;
            }
            .button {
                display: inline-block;
                background: linear-gradient(135deg, #f43f5e 0%, #14b8a6 100%);
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
            }
            @media (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 8px;
                }
                .header, .content, .footer {
                    padding: 20px;
                }
                .otp-code {
                    font-size: 28px;
                    letter-spacing: 4px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏥 Meds Healthcare</h1>
                <p>Your Health, Our Priority</p>
            </div>
            
            <div class="content">
                <div class="greeting">Hello ${userName}! 👋</div>
                
                <div class="message">
                    Welcome to Meds Healthcare! We're excited to have you join our community. 
                    To complete your registration and ensure the security of your account, 
                    please verify your email address using the verification code below.
                </div>
                
                <div class="otp-container">
                    <div class="otp-label">Verification Code</div>
                    <div class="otp-code">${otp}</div>
                    <div class="otp-note">This code will expire in 10 minutes</div>
                </div>
                
                <div class="instructions">
                    <h3>📋 How to verify your email:</h3>
                    <ul>
                        <li>Copy the 6-digit verification code above</li>
                        <li>Return to the Meds Healthcare website</li>
                        <li>Paste the code in the verification field</li>
                        <li>Click "Verify Email" to complete your registration</li>
                    </ul>
                </div>
                
                <div class="security-note">
                    <p>🔒 Security Note: Never share this verification code with anyone. 
                    Meds Healthcare will never ask for your verification code via phone or email.</p>
                </div>
                
                <div style="text-align: center;">
                    <a href="#" class="button">Verify Email Now</a>
                </div>
            </div>
            
            <div class="footer">
                <p>
                    If you didn't create an account with Meds Healthcare, please ignore this email.
                    <br>
                    For support, contact us at <a href="mailto:support@medshealthcare.com">support@medshealthcare.com</a>
                </p>
                <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                    © 2024 Meds Healthcare. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Send OTP email
const sendOTPEmail = async (email, userName, otp) => {
  try {
    const transporter = createTransport();
    
    // If transporter is null, credentials are not configured - log to console instead
    if (!transporter) {
      console.log('\n============================================================');
      console.log('📧 OTP VERIFICATION CODE (Email not configured)');
      console.log('============================================================');
      console.log('👤 User:', userName);
      console.log('📧 Email:', email);
      console.log('🔐 OTP Code:', otp);
      console.log('⏰ Expires: 10 minutes');
      console.log('============================================================');
      console.log('💡 To enable email sending, configure EMAIL_USER and EMAIL_PASS in .env file');
      console.log('💡 For Gmail, use an App Password (not your regular password)');
      console.log('============================================================\n');
      return { success: true, messageId: 'console-logged', consoleLogged: true };
    }

    const emailUser = process.env.EMAIL_USER || process.env.EMAIL_ADDRESS || 'urbanpac20@gmail.com';
    
    const mailOptions = {
      from: `"Meds Healthcare" <${emailUser}>`,
      to: email,
      subject: '🔐 Verify Your Email - Meds Healthcare',
      html: createOTPEmailTemplate(userName, otp),
      text: `Hello ${userName}!\n\nWelcome to Meds Healthcare! Please use this verification code to complete your registration:\n\nVerification Code: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't create an account with Meds Healthcare, please ignore this email.\n\nBest regards,\nMeds Healthcare Team`
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ OTP email sent successfully to:', email);
    console.log('📧 Message ID:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    
    // If authentication fails, log to console as fallback
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      console.log('\n============================================================');
      console.log('⚠️  EMAIL AUTHENTICATION FAILED - Using Console Fallback');
      console.log('============================================================');
      console.log('👤 User:', userName);
      console.log('📧 Email:', email);
      console.log('🔐 OTP Code:', otp);
      console.log('⏰ Expires: 10 minutes');
      console.log('============================================================');
      console.log('💡 Gmail Authentication Error - Please check:');
      console.log('   1. EMAIL_USER and EMAIL_PASS are set in .env file');
      console.log('   2. You are using a Gmail App Password (not regular password)');
      console.log('   3. 2-Step Verification is enabled on your Google account');
      console.log('   4. App Password is generated correctly');
      console.log('   📖 Guide: https://support.google.com/accounts/answer/185833');
      console.log('============================================================\n');
      return { success: true, messageId: 'console-logged', consoleLogged: true, error: error.message };
    }
    
    return { success: false, error: error.message };
  }
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, userName) => {
  try {
    const transporter = createTransport();
    
    // If transporter is null, skip sending welcome email
    if (!transporter) {
      console.log('⚠️  Welcome email skipped - Email credentials not configured');
      return { success: true, messageId: 'skipped', skipped: true };
    }

    const emailUser = process.env.EMAIL_USER || process.env.EMAIL_ADDRESS || 'urbanpac20@gmail.com';
    
    const mailOptions = {
      from: `"Meds Healthcare" <${emailUser}>`,
      to: email,
      subject: '🎉 Welcome to Meds Healthcare!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f43f5e 0%, #14b8a6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">🏥 Meds Healthcare</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your Health, Our Priority</p>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Welcome aboard, ${userName}! 🎉</h2>
            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
              Your email has been successfully verified! You now have full access to all our healthcare services.
            </p>
            <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <h3 style="color: #0c4a6e; margin: 0 0 10px 0;">What's next?</h3>
              <ul style="color: #0c4a6e; margin: 0; padding-left: 20px;">
                <li>Complete your profile setup</li>
                <li>Book your first appointment</li>
                <li>Explore our health resources</li>
                <li>Connect with healthcare professionals</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: linear-gradient(135deg, #f43f5e 0%, #14b8a6 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                Get Started
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px;">
              Thank you for choosing Meds Healthcare for your healthcare needs!
            </p>
          </div>
        </div>
      `,
      text: `Welcome to Meds Healthcare, ${userName}!\n\nYour email has been successfully verified. You now have full access to all our healthcare services.\n\nWhat's next?\n- Complete your profile setup\n- Book your first appointment\n- Explore our health resources\n- Connect with healthcare professionals\n\nThank you for choosing Meds Healthcare!\n\nBest regards,\nMeds Healthcare Team`
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent successfully to:', email);
    console.log('📧 Message ID:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendWelcomeEmail,
  createOTPEmailTemplate
};
