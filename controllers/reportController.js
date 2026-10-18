/**
 * EcoTrack Report Controller
 * Handles report submission, listing, filtering, ownership verification, and history.
 */

const pool = require('../config/database');
const { sanitizeString } = require('../utils/validation');
const { successResponse, errorResponse } = require('../utils/helpers');

// Create new waste report
async function createReport(req, res) {
  let connection;
  try {
    const userId = req.session.userId;
    let { categoryId, description, location, recognitionId } = req.body;

    categoryId = parseInt(categoryId, 10);
    description = sanitizeString(description);
    location = sanitizeString(location);

    if (!categoryId || isNaN(categoryId)) {
      return errorResponse(res, 'Please select a valid waste category.');
    }

    if (!description || description.length < 5) {
      return errorResponse(res, 'Please provide a detailed description (at least 5 characters).');
    }

    if (!location || location.length < 3) {
      return errorResponse(res, 'Please provide a valid location or address.');
    }

    if (!req.file) {
      return errorResponse(res, 'An image of the waste is required for verification.');
    }

    // Verify category exists and is active
    const [categories] = await pool.execute(
      'SELECT id, name FROM waste_categories WHERE id = ? AND status = "active"',
      [categoryId]
    );

    if (categories.length === 0) {
      return errorResponse(res, 'The selected waste category is inactive or does not exist.');
    }

    // Relative web path for the saved image
    const imagePath = '/uploads/waste/' + req.file.filename;

    // Use transaction for atomic report creation and status history recording
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [reportResult] = await connection.execute(
      `INSERT INTO waste_reports 
        (user_id, category_id, description, image_path, location, status) 
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [userId, categoryId, description, imagePath, location]
    );

    const reportId = reportResult.insertId;

    // Record initial status history
    await connection.execute(
      `INSERT INTO report_status_history 
        (report_id, old_status, new_status, changed_by, note) 
       VALUES (?, NULL, 'Pending', ?, 'Waste report submitted by user')`,
      [reportId, userId]
    );

    // If an AI recognition result exists, link it
    if (recognitionId && !isNaN(parseInt(recognitionId, 10))) {
      await connection.execute(
        'UPDATE recognition_results SET report_id = ? WHERE id = ? AND user_id = ?',
        [reportId, parseInt(recognitionId, 10), userId]
      );
    }

    await connection.commit();

    return successResponse(res, 'Waste report submitted successfully!', {
      id: reportId,
      status: 'Pending',
      imagePath,
      location,
      categoryName: categories[0].name
    }, 201);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('createReport error:', error.message);
    return errorResponse(res, 'Failed to submit waste report. Please try again.', 500);
  } finally {
    if (connection) connection.release();
  }
}

// Get reports for authenticated user with search and filters
async function getUserReports(req, res) {
  try {
    const userId = req.session.userId;
    const { status, categoryId, search, sort } = req.query;

    let query = `
      SELECT 
        r.id, 
        r.user_id, 
        r.category_id, 
        r.description, 
        r.image_path, 
        r.location, 
        r.status, 
        r.admin_note, 
        r.created_at, 
        r.updated_at,
        c.name AS category_name,
        c.disposal_method
      FROM waste_reports r
      JOIN waste_categories c ON r.category_id = c.id
      WHERE r.user_id = ?
    `;

    const params = [userId];

    if (status && status !== 'all') {
      query += ' AND r.status = ?';
      params.push(status);
    }

    if (categoryId && categoryId !== 'all') {
      query += ' AND r.category_id = ?';
      params.push(parseInt(categoryId, 10));
    }

    if (search && search.trim() !== '') {
      query += ' AND (r.description LIKE ? OR r.location LIKE ? OR c.name LIKE ?)';
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (sort === 'oldest') {
      query += ' ORDER BY r.created_at ASC';
    } else {
      query += ' ORDER BY r.created_at DESC';
    }

    const [reports] = await pool.execute(query, params);
    return successResponse(res, 'Reports retrieved', reports);
  } catch (error) {
    console.error('getUserReports error:', error.message);
    return errorResponse(res, 'Failed to retrieve reports.', 500);
  }
}

// Get report details by ID with IDOR protection
async function getReportById(req, res) {
  try {
    const reportId = parseInt(req.params.id, 10);
    const userId = req.session.userId;
    const userRole = req.session.role;

    if (isNaN(reportId)) {
      return errorResponse(res, 'Invalid report ID.', 400);
    }

    // Retrieve report details
    const [rows] = await pool.execute(`
      SELECT 
        r.id, 
        r.user_id, 
        r.category_id, 
        r.description, 
        r.image_path, 
        r.location, 
        r.status, 
        r.admin_note, 
        r.created_at, 
        r.updated_at,
        c.name AS category_name,
        c.disposal_method,
        u.full_name AS reporter_name,
        u.email AS reporter_email
      FROM waste_reports r
      JOIN waste_categories c ON r.category_id = c.id
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `, [reportId]);

    if (rows.length === 0) {
      return errorResponse(res, 'Report not found.', 404);
    }

    const report = rows[0];

    // IDOR Protection: regular users can only view their own reports
    if (userRole !== 'admin' && report.user_id !== userId) {
      return errorResponse(res, 'You do not have permission to view this report.', 403);
    }

    // Retrieve collection schedule if available
    const [collections] = await pool.execute(
      'SELECT id, scheduled_date, completed_at, notes, created_at FROM collection_records WHERE report_id = ?',
      [reportId]
    );

    // Retrieve full status transition history
    const [history] = await pool.execute(`
      SELECT 
        h.id, 
        h.old_status, 
        h.new_status, 
        h.note, 
        h.created_at,
        u.full_name AS changer_name,
        u.role AS changer_role
      FROM report_status_history h
      JOIN users u ON h.changed_by = u.id
      WHERE h.report_id = ?
      ORDER BY h.created_at ASC
    `, [reportId]);

    return successResponse(res, 'Report details retrieved', {
      ...report,
      collection: collections.length > 0 ? collections[0] : null,
      history
    });
  } catch (error) {
    console.error('getReportById error:', error.message);
    return errorResponse(res, 'Failed to retrieve report details.', 500);
  }
}

// User Dashboard Statistics
async function getUserStats(req, res) {
  try {
    const userId = req.session.userId;

    const [counts] = await pool.execute(`
      SELECT
        COUNT(*) AS total_reports,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved_count,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN status = 'Collected' THEN 1 ELSE 0 END) AS collected_count,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_count
      FROM waste_reports
      WHERE user_id = ?
    `, [userId]);

    // Fetch recent 5 reports for dashboard table
    const [recentReports] = await pool.execute(`
      SELECT 
        r.id, 
        r.description, 
        r.image_path, 
        r.location, 
        r.status, 
        r.created_at,
        c.name AS category_name
      FROM waste_reports r
      JOIN waste_categories c ON r.category_id = c.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT 5
    `, [userId]);

    return successResponse(res, 'User statistics retrieved', {
      stats: {
        total: Number(counts[0].total_reports) || 0,
        pending: Number(counts[0].pending_count) || 0,
        approved: Number(counts[0].approved_count) || 0,
        inProgress: Number(counts[0].in_progress_count) || 0,
        collected: Number(counts[0].collected_count) || 0,
        rejected: Number(counts[0].rejected_count) || 0
      },
      recentReports
    });
  } catch (error) {
    console.error('getUserStats error:', error.message);
    return errorResponse(res, 'Failed to fetch dashboard statistics.', 500);
  }
}

module.exports = {
  createReport,
  getUserReports,
  getReportById,
  getUserStats
};
