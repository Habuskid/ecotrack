/**
 * EcoTrack Category Routes
 */

const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Public/authenticated endpoint for active categories
router.get('/', categoryController.getActiveCategories);

module.exports = router;
