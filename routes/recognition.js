/**
 * EcoTrack AI Waste Recognition Routes
 */

const express = require('express');
const router = express.Router();
const recognitionController = require('../controllers/recognitionController');
const { requireLogin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Identify waste image
router.post('/', requireLogin, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Image upload failed. Only JPEG/PNG/WebP files under 5MB are permitted.'
      });
    }
    next();
  });
}, recognitionController.identifyWaste);

module.exports = router;
