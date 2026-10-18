/**
 * EcoTrack Admin Controller
 * Handles administration dashboard analytics, report status transitions,
 * and user management.
 */

const pool = require('../config/database');
const { isValidStatusTransition, sanitizeString } = require('../utils/validation');
const { successResponse, errorResponse } = require('../utils/helpers');

// Admin Dashboard Summary & Analytics
async function getDashboardStats(req, res) {
  try {
    // 1. User counts
    const [userCounts] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_users,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_users
      FROM users 
      WHERE role = 'user'
    `);

    // 2. Report counts
    const [reportCounts] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_reports,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved_count,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN status = 'Collected' THEN 1 ELSE 0 END) AS collected_count,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_count
      FROM waste_reports
    `);

    // 3. Category distribution (for Chart.js)
    const [categoryStats] = await pool.execute(`
      SELECT 
        c.name, 
        COUNT(r.id) AS count
      FROM waste_categories c
      LEFT JOIN waste_reports r ON c.id = r.category_id
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `);

    // 4. Status distribution (for Chart.js)
    const [statusStats] = await pool.execute(`
      SELECT 
        status, 
        COUNT(*) AS count 
      FROM waste_reports 
      GROUP BY status
    `);

    // 5. Recent reports
    const [recentReports] = await pool.execute(`
      SELECT 
        r.id, 
        r.description, 
        r.location, 
        r.status, 
        r.image_path,
        r.created_at,
        c.name AS category_name,
        u.full_name AS reporter_name
      FROM waste_reports r
      JOIN waste_categories c ON r.category_id = c.id
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
      LIMIT 6
    `);

    // 6. Recent registered users
    const [recentUsers] = await pool.execute(`
      SELECT 
        id, 
        full_name, 
        email, 
        role, 
        status, 
        created_at 
      FROM users 
      WHERE role = 'user'
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    return successResponse(res, 'Admin dashboard statistics retrieved', {
      summary: {
        totalUsers: Number(userCounts[0].total_users) || 0,
        activeUsers: Number(userCounts[0].active_users) || 0,
        totalReports: Number(reportCounts[0].total_reports) || 0,
        pending: Number(reportCounts[0].pending_count) || 0,
        approved: Number(reportCounts[0].approved_count) || 0,
        inProgress: Number(reportCounts[0].in_progress_count) || 0,
        collected: Number(reportCounts[0].collected_count) || 0,
        rejected: Number(reportCounts[0].rejected_count) || 0
      },
      charts: {
        categories: categoryStats,
        statuses: statusStats
      },
      recentReports,
      recentUsers
    });
  } catch (error) {
    console.error('getDashboardStats error:', error.message);
    return errorResponse(res, 'Failed to fetch dashboard statistics.', 500);
  }
}

// Get all reports for admin with search and filters
async function getAllReports(req, res) {
  try {
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
        u.full_name AS reporter_name,
        u.email AS reporter_email
      FROM waste_reports r
      JOIN waste_categories c ON r.category_id = c.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (status && status !== 'all') {
      query += ' AND r.status = ?';
      params.push(status);
    }

    if (categoryId && categoryId !== 'all') {
      query += ' AND r.category_id = ?';
      params.push(parseInt(categoryId, 10));
    }

    if (search && search.trim() !== '') {
      query += ' AND (r.description LIKE ? OR r.location LIKE ? OR c.name LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    if (sort === 'oldest') {
      query += ' ORDER BY r.created_at ASC';
    } else {
      query += ' ORDER BY r.created_at DESC';
    }

    const [reports] = await pool.execute(query, params);
    return successResponse(res, 'Admin reports retrieved', reports);
  } catch (error) {
    console.error('getAllReports error:', error.message);
    return errorResponse(res, 'Failed to fetch reports.', 500);
  }
}

// Update report status with validation and history logging
async function updateReportStatus(req, res) {
  let connection;
  try {
    const reportId = parseInt(req.params.id, 10);
    const adminId = req.session.userId;
    let { status: newStatus, note } = req.body;

    note = sanitizeString(note);

    if (isNaN(reportId)) {
      return errorResponse(res, 'Invalid report ID.', 400);
    }

    const [reports] = await pool.execute(
      'SELECT id, status, admin_note FROM waste_reports WHERE id = ?',
      [reportId]
    );

    if (reports.length === 0) {
      return errorResponse(res, 'Report not found.', 404);
    }

    const currentStatus = reports[0].status;

    if (currentStatus === newStatus) {
      return errorResponse(res, `Report is already in status '${newStatus}'.`);
    }

    // Validate workflow transition
    if (!isValidStatusTransition(currentStatus, newStatus)) {
      return errorResponse(
        res,
        `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed workflow: Pending -> Approved/Rejected -> In Progress -> Collected.`
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Update report
    await connection.execute(
      'UPDATE waste_reports SET status = ?, admin_note = IFNULL(?, admin_note) WHERE id = ?',
      [newStatus, note || null, reportId]
    );

    // Record history
    await connection.execute(
      `INSERT INTO report_status_history 
        (report_id, old_status, new_status, changed_by, note) 
       VALUES (?, ?, ?, ?, ?)`,
      [reportId, currentStatus, newStatus, adminId, note || `Status changed from ${currentStatus} to ${newStatus}`]
    );

    // If marked as Collected, update collection completion if scheduled
    if (newStatus === 'Collected') {
      await connection.execute(
        'UPDATE collection_records SET completed_at = IFNULL(completed_at, NOW()) WHERE report_id = ?',
        [reportId]
      );
    }

    await connection.commit();

    return successResponse(res, `Report status updated to '${newStatus}' successfully.`);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('updateReportStatus error:', error.message);
    return errorResponse(res, 'Failed to update report status.', 500);
  } finally {
    if (connection) connection.release();
  }
}

// Update admin note on report
async function updateReportNote(req, res) {
  try {
    const reportId = parseInt(req.params.id, 10);
    let { note } = req.body;
    note = sanitizeString(note);

    if (isNaN(reportId)) {
      return errorResponse(res, 'Invalid report ID.', 400);
    }

    await pool.execute('UPDATE waste_reports SET admin_note = ? WHERE id = ?', [note, reportId]);
    return successResponse(res, 'Admin note updated successfully.');
  } catch (error) {
    console.error('updateReportNote error:', error.message);
    return errorResponse(res, 'Failed to update note.', 500);
  }
}

// Get all users for admin
async function getAllUsers(req, res) {
  try {
    const { search, role, status } = req.query;

    let query = `
      SELECT 
        u.id, 
        u.full_name, 
        u.email, 
        u.role, 
        u.status, 
        u.created_at,
        COUNT(r.id) AS report_count
      FROM users u
      LEFT JOIN waste_reports r ON u.id = r.user_id
      WHERE 1=1
    `;

    const params = [];

    if (role && role !== 'all') {
      query += ' AND u.role = ?';
      params.push(role);
    }

    if (status && status !== 'all') {
      query += ' AND u.status = ?';
      params.push(status);
    }

    if (search && search.trim() !== '') {
      query += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    query += ' GROUP BY u.id ORDER BY u.created_at DESC';

    const [users] = await pool.execute(query, params);
    return successResponse(res, 'Users retrieved', users);
  } catch (error) {
    console.error('getAllUsers error:', error.message);
    return errorResponse(res, 'Failed to fetch users.', 500);
  }
}

// Toggle user status (active / inactive) with last-admin safeguard
async function toggleUserStatus(req, res) {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (isNaN(targetUserId)) {
      return errorResponse(res, 'Invalid user ID.', 400);
    }

    if (status !== 'active' && status !== 'inactive') {
      return errorResponse(res, 'Status must be active or inactive.');
    }

    // Check target user
    const [target] = await pool.execute(
      'SELECT id, role, status, email FROM users WHERE id = ?',
      [targetUserId]
    );

    if (target.length === 0) {
      return errorResponse(res, 'User not found.', 404);
    }

    // Critical safeguard: Prevent disabling the last active administrator
    if (target[0].role === 'admin' && status === 'inactive') {
      const [adminCount] = await pool.execute(
        'SELECT COUNT(*) AS count FROM users WHERE role = "admin" AND status = "active" AND id != ?',
        [targetUserId]
      );

      if (adminCount[0].count === 0) {
        return errorResponse(
          res,
          'Action prohibited: Cannot deactivate the only remaining active administrator account in the system.',
          403
        );
      }
    }

    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, targetUserId]);

    return successResponse(res, `User account successfully ${status === 'active' ? 'activated' : 'deactivated'}.`);
  } catch (error) {
    console.error('toggleUserStatus error:', error.message);
    return errorResponse(res, 'Failed to update user status.', 500);
  }
}

module.exports = {
  getDashboardStats,
  getAllReports,
  updateReportStatus,
  updateReportNote,
  getAllUsers,
  toggleUserStatus
};
