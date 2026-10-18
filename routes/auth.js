/**
 * EcoTrack Auth Routes
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 login requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.getMe);

module.exports = router;
