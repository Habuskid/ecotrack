/**
 * EcoTrack — Smart Waste Management System
 * Main Express Application Server
 */

const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

// Middleware
const { requireLogin, requireAdmin } = require('./middleware/auth');

// Route Handlers
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const reportRoutes = require('./routes/reports');
const collectionRoutes = require('./routes/collections');
const recognitionRoutes = require('./routes/recognition');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Express Session Configuration
app.use(session({
  name: 'ecotrack_sid',
  secret: process.env.SESSION_SECRET || 'ecotrack_academic_default_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // Prevents client-side script access
    secure: process.env.NODE_ENV === 'production', // True if running on HTTPS
    sameSite: 'lax', // CSRF protection
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Safe Static Serving for User Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    // Explicitly disallow execution of uploaded files
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// Server-side Page Route Guards (AIRTIGHT SECURITY)
// Normal users and guests are completely blocked from admin HTML files at the server level
app.use('/admin', requireAdmin, express.static(path.join(__dirname, 'public', 'admin')));

// Guests are completely blocked from user dashboard and report HTML files at the server level
app.use('/user', requireLogin, express.static(path.join(__dirname, 'public', 'user')));

// Serve general public static files (Landing page, login, register, css, js)
app.use(express.static(path.join(__dirname, 'public')));

// Public API for landing page real metrics
const pool = require('./config/database');
app.get('/api/public/stats', async (req, res) => {
  try {
    const [reports] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_reports,
        SUM(CASE WHEN status = 'Collected' THEN 1 ELSE 0 END) AS collected_reports,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_reports
      FROM waste_reports
    `);

    const [users] = await pool.execute('SELECT COUNT(*) AS total_users FROM users WHERE role = "user" AND status = "active"');
    const [categories] = await pool.execute('SELECT COUNT(*) AS total_categories FROM waste_categories WHERE status = "active"');

    res.json({
      success: true,
      data: {
        totalReports: Number(reports[0].total_reports) || 0,
        collectedReports: Number(reports[0].collected_reports) || 0,
        activeCitizens: Number(users[0].total_users) || 0,
        categoriesCount: Number(categories[0].total_categories) || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch public stats' });
  }
});

// REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/recognition', recognitionRoutes);
app.use('/api/admin', adminRoutes);

// Root path fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 Handler for API and missing pages
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(404).json({
      success: false,
      message: 'API endpoint not found.'
    });
  }
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>404 - Page Not Found | EcoTrack</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>body { background: #F8FAFC; color: #1E293B; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif; }</style>
    </head>
    <body class="text-center p-4">
      <div>
        <h1 class="display-3 fw-bold text-success mb-2">404</h1>
        <h3 class="mb-3">Page Not Found</h3>
        <p class="text-muted mb-4">The page or resource you are looking for does not exist.</p>
        <a href="/" class="btn btn-success px-4 py-2">Return to EcoTrack Home</a>
      </div>
    </body>
    </html>
  `);
});

// Global Error Handler (Never leaks SQL or stack traces to users)
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred. Please try again later.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🌱 EcoTrack Server is running on: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`====================================================`);
});
