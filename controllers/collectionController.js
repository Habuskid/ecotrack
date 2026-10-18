/**
 * EcoTrack Collection Controller
 * Manages scheduling, notes, and completion of waste collections.
 */

const pool = require('../config/database');
const { sanitizeString } = require('../utils/validation');
const { successResponse, errorResponse } = require('../utils/helpers');

// Get all collections and eligible reports for admin
async function getCollections(req, res) {
  try {
    const { status } = req.query;

    let query = `
      SELECT 
        cr.id AS collection_id,
        cr.scheduled_date,
        cr.completed_at,
        cr.notes AS collection_notes,
        cr.created_at AS collection_created_at,
        r.id AS report_id,
        r.description,
        r.location,
        r.status AS report_status,
        r.created_at AS report_date,
        c.name AS category_name,
        u.full_name AS reporter_name,
        u.email AS reporter_email
      FROM waste_reports r
      JOIN waste_categories c ON r.category_id = c.id
      JOIN users u ON r.user_id = u.id
      LEFT JOIN collection_records cr ON r.id = cr.report_id
      WHERE r.status IN ('Approved', 'In Progress', 'Collected')
    `;

    const params = [];

    if (status && status !== 'all') {
      query += ' AND r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY cr.scheduled_date ASC, r.created_at DESC';

    const [records] = await pool.execute(query, params);
    return successResponse(res, 'Collections retrieved', records);
  } catch (error) {
    console.error('getCollections error:', error.message);
    return errorResponse(res, 'Failed to fetch collection records.', 500);
  }
}

// Schedule or update collection for a report (Admin)
async function scheduleCollection(req, res) {
  let connection;
  try {
    const adminId = req.session.userId;
    let { reportId, scheduledDate, notes } = req.body;

    reportId = parseInt(reportId, 10);
    scheduledDate = sanitizeString(scheduledDate);
    notes = sanitizeString(notes);

    if (!reportId || isNaN(reportId)) {
      return errorResponse(res, 'Valid report ID is required.');
    }

    if (!scheduledDate) {
      return errorResponse(res, 'Scheduled collection date is required.');
    }

    // Verify report status
    const [reports] = await pool.execute(
      'SELECT id, status FROM waste_reports WHERE id = ?',
      [reportId]
    );

    if (reports.length === 0) {
      return errorResponse(res, 'Waste report not found.', 404);
    }

    const currentStatus = reports[0].status;
    if (currentStatus !== 'Approved' && currentStatus !== 'In Progress') {
      return errorResponse(res, `Cannot schedule collection for a report with status '${currentStatus}'. Report must be Approved.`);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check if a record already exists
    const [existing] = await connection.execute(
      'SELECT id FROM collection_records WHERE report_id = ?',
      [reportId]
    );

    if (existing.length > 0) {
      await connection.execute(
        'UPDATE collection_records SET scheduled_date = ?, notes = ? WHERE report_id = ?',
        [scheduledDate, notes, reportId]
      );
    } else {
      await connection.execute(
        'INSERT INTO collection_records (report_id, scheduled_date, notes) VALUES (?, ?, ?)',
        [reportId, scheduledDate, notes]
      );
    }

    // Advance status to 'In Progress' if currently 'Approved'
    if (currentStatus === 'Approved') {
      await connection.execute(
        'UPDATE waste_reports SET status = "In Progress" WHERE id = ?',
        [reportId]
      );

      await connection.execute(
        `INSERT INTO report_status_history 
          (report_id, old_status, new_status, changed_by, note) 
         VALUES (?, 'Approved', 'In Progress', ?, ?)`,
        [reportId, adminId, `Collection scheduled for ${scheduledDate}. Notes: ${notes || 'None'}`]
      );
    }

    await connection.commit();

    return successResponse(res, 'Collection scheduled successfully.');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('scheduleCollection error:', error.message);
    return errorResponse(res, 'Failed to schedule collection.', 500);
  } finally {
    if (connection) connection.release();
  }
}

// Mark collection complete (Admin)
async function completeCollection(req, res) {
  let connection;
  try {
    const adminId = req.session.userId;
    const reportId = parseInt(req.params.reportId, 10);
    const { notes } = req.body;

    if (isNaN(reportId)) {
      return errorResponse(res, 'Invalid report ID.', 400);
    }

    const [reports] = await pool.execute(
      'SELECT id, status FROM waste_reports WHERE id = ?',
      [reportId]
    );

    if (reports.length === 0) {
      return errorResponse(res, 'Report not found.', 404);
    }

    const currentStatus = reports[0].status;
    if (currentStatus === 'Collected') {
      return errorResponse(res, 'This collection has already been completed.');
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Update or insert collection record
    const [existing] = await connection.execute(
      'SELECT id FROM collection_records WHERE report_id = ?',
      [reportId]
    );

    const completionNote = sanitizeString(notes) || 'Waste collection verified and marked as collected.';

    if (existing.length > 0) {
      await connection.execute(
        'UPDATE collection_records SET completed_at = NOW(), notes = CONCAT(IFNULL(notes, ""), " | Completed: ", ?) WHERE report_id = ?',
        [completionNote, reportId]
      );
    } else {
      await connection.execute(
        'INSERT INTO collection_records (report_id, scheduled_date, completed_at, notes) VALUES (?, CURDATE(), NOW(), ?)',
        [reportId, completionNote]
      );
    }

    // Update report status to 'Collected'
    await connection.execute(
      'UPDATE waste_reports SET status = "Collected" WHERE id = ?',
      [reportId]
    );

    // Record status transition
    await connection.execute(
      `INSERT INTO report_status_history 
        (report_id, old_status, new_status, changed_by, note) 
       VALUES (?, ?, 'Collected', ?, ?)`,
      [reportId, currentStatus, adminId, completionNote]
    );

    await connection.commit();

    return successResponse(res, 'Collection successfully marked as Collected.');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('completeCollection error:', error.message);
    return errorResponse(res, 'Failed to complete collection.', 500);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getCollections,
  scheduleCollection,
  completeCollection
};
