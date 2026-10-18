/**
 * EcoTrack Auth Controller
 * Handles user registration, login, logout, and session check.
 */

const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { isValidEmail, isValidPassword, sanitizeString } = require('../utils/validation');
const { successResponse, errorResponse } = require('../utils/helpers');

// Register a new user
async function register(req, res) {
  try {
    let { fullName, email, password, confirmPassword } = req.body;

    fullName = sanitizeString(fullName);
    email = sanitizeString(email).toLowerCase();

    // Field validation
    if (!fullName || !email || !password || !confirmPassword) {
      return errorResponse(res, 'All fields are required.');
    }

    if (fullName.length < 2 || fullName.length > 100) {
      return errorResponse(res, 'Full name must be between 2 and 100 characters.');
    }

    if (!isValidEmail(email)) {
      return errorResponse(res, 'Please provide a valid email address.');
    }

    if (!isValidPassword(password)) {
      return errorResponse(res, 'Password must be at least 6 characters long.');
    }

    if (password !== confirmPassword) {
      return errorResponse(res, 'Passwords do not match.');
    }

    // Check for duplicate email
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return errorResponse(res, 'An account with this email address already exists.', 409);
    }

    // Hash password with bcrypt (salt rounds = 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Always create as regular 'user' role
    const [result] = await pool.execute(
      'INSERT INTO users (full_name, email, password, role, status) VALUES (?, ?, ?, "user", "active")',
      [fullName, email, hashedPassword]
    );

    // Initialize session automatically
    req.session.userId = result.insertId;
    req.session.fullName = fullName;
    req.session.email = email;
    req.session.role = 'user';

    return successResponse(res, 'Account created successfully! Welcome to EcoTrack.', {
      id: result.insertId,
      fullName,
      email,
      role: 'user'
    }, 201);
  } catch (error) {
    console.error('Registration error:', error.message);
    return errorResponse(res, 'Failed to complete registration. Please try again.', 500);
  }
}

// User Login
async function login(req, res) {
  try {
    let { email, password } = req.body;

    email = sanitizeString(email).toLowerCase();

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required.');
    }

    // Query user by email
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

    // Use generic error for security (do not disclose if email exists)
    if (rows.length === 0) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    const user = rows[0];

    // Check account status
    if (user.status !== 'active') {
      return errorResponse(res, 'Your account has been deactivated. Please contact an administrator.', 403);
    }

    // Verify bcrypt password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    // Set session details
    req.session.userId = user.id;
    req.session.fullName = user.full_name;
    req.session.email = user.email;
    req.session.role = user.role;

    // Determine redirect path
    const redirectUrl = user.role === 'admin' ? '/admin/dashboard.html' : '/user/dashboard.html';

    return successResponse(res, 'Login successful!', {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      redirectUrl
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return errorResponse(res, 'An error occurred during login. Please try again.', 500);
  }
}

// User Logout
function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err.message);
      return errorResponse(res, 'Failed to log out.', 500);
    }
    res.clearCookie('connect.sid');
    return successResponse(res, 'Logged out successfully.');
  });
}

// Get current session user
function getMe(req, res) {
  if (req.session && req.session.userId) {
    return successResponse(res, 'User session active', {
      authenticated: true,
      id: req.session.userId,
      fullName: req.session.fullName,
      email: req.session.email,
      role: req.session.role
    });
  }
  return res.json({
    success: true,
    data: {
      authenticated: false
    }
  });
}

module.exports = {
  register,
  login,
  logout,
  getMe
};
