# Email Setup Instructions

## Current Status
The OTP verification system will automatically fall back to console logging if email credentials are not configured or if authentication fails. This ensures users can still register even if email is not set up.

## To Enable Email Sending

### Step 1: Configure Gmail App Password

**Important:** Gmail requires an App Password (not your regular password) when using 2-Step Verification.

1. **Enable 2-Step Verification:**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Click on "2-Step Verification"
   - Follow the prompts to enable it

2. **Generate App Password:**
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" as the app
   - Select "Other (Custom name)" as the device
   - Enter "Meds Healthcare" as the name
   - Click "Generate"
   - **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)

### Step 2: Update .env File

Edit the `server/.env` file and update these lines:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
```

**Important Notes:**
- Remove spaces from the App Password (e.g., `abcdefghijklmnop` instead of `abcd efgh ijkl mnop`)
- Use the email address associated with your Google account
- Never commit your `.env` file to version control

### Step 3: Restart Server

After updating the `.env` file, restart your server:

```bash
npm start
# or
node server.js
```

## Troubleshooting

### Error: "535-5.7.8 Username and Password not accepted"

This error means Gmail is rejecting your credentials. Common causes:

1. **Using Regular Password Instead of App Password:**
   - ❌ Don't use your Gmail account password
   - ✅ Use the 16-character App Password you generated

2. **2-Step Verification Not Enabled:**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification first
   - Then generate an App Password

3. **App Password Expired or Revoked:**
   - Generate a new App Password
   - Update `EMAIL_PASS` in your `.env` file
   - Restart the server

4. **Spaces in App Password:**
   - Remove all spaces from the App Password
   - Example: `abcdefghijklmnop` not `abcd efgh ijkl mnop`

5. **Wrong Email Address:**
   - Make sure `EMAIL_USER` matches the Gmail account where you generated the App Password

### Fallback Behavior

If email sending fails, the system will:
- Log the OTP code to the server console
- Allow user registration to continue
- Display the OTP in the console for testing

Check your server console for output like:
```
============================================================
📧 OTP VERIFICATION CODE (Email not configured)
============================================================
👤 User: John Doe
📧 Email: john@example.com
🔐 OTP Code: 123456
⏰ Expires: 10 minutes
============================================================
```

## Testing OTP Verification

1. **With Email Setup:**
   - Configure the `.env` file as described above
   - Restart the server
   - Register a new user
   - Check your email inbox for the verification code

2. **Without Email Setup (Fallback):**
   - Register a new user
   - Check the server console for the OTP code
   - Enter the code in the verification form

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






