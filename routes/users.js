/**
 * EcoTrack User Routes
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireLogin } = require('../middleware/auth');

router.get('/profile', requireLogin, userController.getProfile);
router.put('/profile', requireLogin, userController.updateProfile);
router.put('/change-password', requireLogin, userController.changePassword);

module.exports = router;
