/**
 * EcoTrack Authentication & Authorization Middleware
 */

function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  // Handle API requests
  if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to continue.'
    });
  }

  // Handle standard page requests
  return res.redirect('/login.html');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.userId) {
    if (req.session.role === 'admin') {
      return next();
    }
    // Authenticated but not an admin
    if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }
    return res.redirect('/user/dashboard.html');
  }

  // Not logged in
  if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in as an administrator.'
    });
  }

  return res.redirect('/login.html');
}

function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.userId) {
    if (req.session.role === 'admin') {
      return res.redirect('/admin/dashboard.html');
    }
    return res.redirect('/user/dashboard.html');
  }
  return next();
}

module.exports = {
  requireLogin,
  requireAdmin,
  redirectIfLoggedIn
};
