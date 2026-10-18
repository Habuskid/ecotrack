/**
 * EcoTrack User Profile Controller
 */

const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { isValidEmail, isValidPassword, sanitizeString } = require('../utils/validation');
const { successResponse, errorResponse } = require('../utils/helpers');

// Get profile of authenticated user
async function getProfile(req, res) {
  try {
    const userId = req.session.userId;
    const [rows] = await pool.execute(
      'SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'User not found.', 404);
    }

    return successResponse(res, 'Profile retrieved', rows[0]);
  } catch (error) {
    console.error('getProfile error:', error.message);
    return errorResponse(res, 'Failed to retrieve profile.', 500);
  }
}

// Update profile name and email
async function updateProfile(req, res) {
  try {
    const userId = req.session.userId;
    let { fullName, email } = req.body;

    fullName = sanitizeString(fullName);
    email = sanitizeString(email).toLowerCase();

    if (!fullName || !email) {
      return errorResponse(res, 'Name and email are required.');
    }

    if (!isValidEmail(email)) {
      return errorResponse(res, 'Please provide a valid email address.');
    }

    // Check if new email is used by another account
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, userId]
    );

    if (existing.length > 0) {
      return errorResponse(res, 'This email address is already in use by another account.', 409);
    }

    await pool.execute(
      'UPDATE users SET full_name = ?, email = ? WHERE id = ?',
      [fullName, email, userId]
    );

    // Update active session
    req.session.fullName = fullName;
    req.session.email = email;

    return successResponse(res, 'Profile updated successfully.', {
      id: userId,
      fullName,
      email
    });
  } catch (error) {
    console.error('updateProfile error:', error.message);
    return errorResponse(res, 'Failed to update profile.', 500);
  }
}

// Change account password
async function changePassword(req, res) {
  try {
    const userId = req.session.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return errorResponse(res, 'All password fields are required.');
    }

    if (!isValidPassword(newPassword)) {
      return errorResponse(res, 'New password must be at least 6 characters long.');
    }

    if (newPassword !== confirmPassword) {
      return errorResponse(res, 'New passwords do not match.');
    }

    // Fetch user hash
    const [rows] = await pool.execute('SELECT password FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return errorResponse(res, 'User account not found.', 404);
    }

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect.', 400);
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);

    return successResponse(res, 'Password changed successfully.');
  } catch (error) {
    console.error('changePassword error:', error.message);
    return errorResponse(res, 'Failed to change password.', 500);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword
};
