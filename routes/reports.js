/**
 * EcoTrack Report Routes
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireLogin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// User dashboard summary statistics
router.get('/stats/summary', requireLogin, reportController.getUserStats);

// List user reports (supports filtering & search)
router.get('/', requireLogin, reportController.getUserReports);

// Get specific report by ID (with IDOR protection)
router.get('/:id', requireLogin, reportController.getReportById);

// Submit new waste report (with image upload)
router.post('/', requireLogin, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Image upload failed. Ensure the file is a JPEG/PNG/WebP under 5MB.'
      });
    }
    next();
  });
}, reportController.createReport);

module.exports = router;
