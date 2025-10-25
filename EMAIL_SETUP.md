# Email Setup Instructions

## Current Status
The OTP verification system is currently configured to log verification codes to the server console instead of sending emails. This is because email credentials are not configured.

## To Enable Email Sending

1. **Create a `.env` file** in the `server` directory with the following content:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/meds-healthcare

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Server Configuration
PORT=5000
NODE_ENV=development
```

2. **For Gmail Setup:**
   - Go to your Google Account settings
   - Navigate to Security > 2-Step Verification
   - Generate an "App Password" for this application
   - Use the App Password (not your regular password) in the `EMAIL_PASS` field

3. **For Other Email Providers:**
   - Update the `service` field in `server/services/emailService.js`
   - Configure the appropriate SMTP settings

## Testing OTP Verification

1. **Without Email Setup (Current):**
   - Register a new user
   - Check the server console for the OTP code
   - Enter the code in the verification form

2. **With Email Setup:**
   - Configure the `.env` file as described above
   - Restart the server
   - Register a new user
   - Check your email for the verification code

## Current Console Output

When you register a new user, you'll see output like this in the server console:

```
============================================================
📧 OTP VERIFICATION CODE
============================================================
👤 User: John Doe
📧 Email: john@example.com
🔐 OTP Code: 123456
⏰ Expires: 10 minutes
============================================================
💡 To enable email sending, configure EMAIL_USER and EMAIL_PASS in .env file
============================================================
```

Use the displayed OTP code to complete the verification process.






