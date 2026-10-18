/**
 * EcoTrack Admin Routes
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryController');
const { requireAdmin } = require('../middleware/auth');

// Protect all admin endpoints with requireAdmin
router.use(requireAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Report Management
router.get('/reports', adminController.getAllReports);
router.patch('/reports/:id/status', adminController.updateReportStatus);
router.patch('/reports/:id/note', adminController.updateReportNote);

// User Management
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/status', adminController.toggleUserStatus);

// Category Management
router.get('/categories', categoryController.getAllCategoriesAdmin);
router.post('/categories', categoryController.createCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

module.exports = router;
