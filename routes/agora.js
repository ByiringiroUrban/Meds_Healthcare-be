const express = require('express');
const router = express.Router();
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { authenticate } = require('../middleware/auth');

// Agora credentials for Meds Healthcare - loaded from environment variables
const AGORA_APP_ID = process.env.AGORA_APP_ID || '901e5ee9d70847eab46f66efe0b1bb31';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '2c0b4410ad0b4ef78e4deac79e29c0ee';

// Token expiration time (24 hours)
const TOKEN_EXPIRATION_TIME = 3600 * 24;

// GET /api/agora/token - Generate Agora RTC token
router.get('/token', authenticate, async (req, res) => {
  try {
    const { channelName, uid } = req.query;

    if (!channelName) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    // Generate UID from user ID - convert MongoDB ObjectId to numeric UID
    // Use 0 to let Agora auto-assign UID (most reliable) or use provided UID
    let actualUid = 0;
    
    if (uid) {
      // If UID is provided, parse it as integer
      const parsedUid = parseInt(uid);
      if (!isNaN(parsedUid) && parsedUid >= 0) {
        // Ensure UID is within valid range (0 or 1 to 2^32-1)
        actualUid = parsedUid > 4294967295 ? parsedUid % 4294967295 : parsedUid;
      }
    }
    // Otherwise use 0 to let Agora auto-assign UID
    
    // Calculate expiration time
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpiredTime = currentTime + TOKEN_EXPIRATION_TIME;

    console.log('🔑 Generating Agora token:', {
      channelName,
      uid: actualUid,
      userId: req.user?._id,
      expirationTime: privilegeExpiredTime
    });

    // Build token with publisher role (can publish and subscribe)
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      actualUid,
      RtcRole.PUBLISHER,
      privilegeExpiredTime
    );

    res.json({
      token,
      appId: AGORA_APP_ID,
      channelName,
      uid: Number(actualUid),
      expirationTime: privilegeExpiredTime
    });
  } catch (error) {
    console.error('Error generating Agora token:', error);
    res.status(500).json({ error: 'Failed to generate token', details: error.message });
  }
});

// GET /api/agora/config - Get Agora configuration
router.get('/config', authenticate, (req, res) => {
  res.json({
    appId: AGORA_APP_ID,
    // Don't send certificate to client for security
  });
});

module.exports = router;




