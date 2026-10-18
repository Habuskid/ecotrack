/**
 * EcoTrack Category Controller
 */

const pool = require('../config/database');
const { sanitizeString } = require('../utils/validation');
const { successResponse, errorResponse } = require('../utils/helpers');

// Get all active categories (for user forms & public selection)
async function getActiveCategories(req, res) {
  try {
    const [categories] = await pool.execute(
      'SELECT id, name, description, disposal_method FROM waste_categories WHERE status = "active" ORDER BY name ASC'
    );
    return successResponse(res, 'Categories retrieved', categories);
  } catch (error) {
    console.error('getActiveCategories error:', error.message);
    return errorResponse(res, 'Failed to fetch categories.', 500);
  }
}

// Get all categories for admin (including inactive and report counts)
async function getAllCategoriesAdmin(req, res) {
  try {
    const [categories] = await pool.execute(`
      SELECT 
        c.id, 
        c.name, 
        c.description, 
        c.disposal_method, 
        c.status, 
        c.created_at,
        c.updated_at,
        COUNT(r.id) AS report_count
      FROM waste_categories c
      LEFT JOIN waste_reports r ON c.id = r.category_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    return successResponse(res, 'Admin categories retrieved', categories);
  } catch (error) {
    console.error('getAllCategoriesAdmin error:', error.message);
    return errorResponse(res, 'Failed to fetch categories.', 500);
  }
}

// Create a new category (Admin)
async function createCategory(req, res) {
  try {
    let { name, description, disposalMethod } = req.body;

    name = sanitizeString(name);
    description = sanitizeString(description);
    disposalMethod = sanitizeString(disposalMethod);

    if (!name) {
      return errorResponse(res, 'Category name is required.');
    }

    if (!disposalMethod) {
      return errorResponse(res, 'Disposal method recommendation is required.');
    }

    // Check duplicate name
    const [existing] = await pool.execute('SELECT id FROM waste_categories WHERE name = ?', [name]);
    if (existing.length > 0) {
      return errorResponse(res, 'A category with this name already exists.', 409);
    }

    const [result] = await pool.execute(
      'INSERT INTO waste_categories (name, description, disposal_method, status) VALUES (?, ?, ?, "active")',
      [name, description, disposalMethod]
    );

    return successResponse(res, 'Category created successfully.', {
      id: result.insertId,
      name,
      description,
      disposal_method: disposalMethod,
      status: 'active'
    }, 201);
  } catch (error) {
    console.error('createCategory error:', error.message);
    return errorResponse(res, 'Failed to create category.', 500);
  }
}

// Update an existing category (Admin)
async function updateCategory(req, res) {
  try {
    const categoryId = parseInt(req.params.id, 10);
    let { name, description, disposalMethod, status } = req.body;

    name = sanitizeString(name);
    description = sanitizeString(description);
    disposalMethod = sanitizeString(disposalMethod);

    if (!name || !disposalMethod) {
      return errorResponse(res, 'Category name and disposal method are required.');
    }

    // Check category exists
    const [current] = await pool.execute('SELECT id FROM waste_categories WHERE id = ?', [categoryId]);
    if (current.length === 0) {
      return errorResponse(res, 'Category not found.', 404);
    }

    // Check duplicate name on another category
    const [existing] = await pool.execute(
      'SELECT id FROM waste_categories WHERE name = ? AND id != ?',
      [name, categoryId]
    );
    if (existing.length > 0) {
      return errorResponse(res, 'Another category already uses this name.', 409);
    }

    const validStatus = status === 'inactive' ? 'inactive' : 'active';

    await pool.execute(
      'UPDATE waste_categories SET name = ?, description = ?, disposal_method = ?, status = ? WHERE id = ?',
      [name, description, disposalMethod, validStatus, categoryId]
    );

    return successResponse(res, 'Category updated successfully.');
  } catch (error) {
    console.error('updateCategory error:', error.message);
    return errorResponse(res, 'Failed to update category.', 500);
  }
}

// Delete or toggle category status (Admin)
async function deleteCategory(req, res) {
  try {
    const categoryId = parseInt(req.params.id, 10);

    // Check if referenced by existing waste reports
    const [reports] = await pool.execute(
      'SELECT COUNT(*) as count FROM waste_reports WHERE category_id = ?',
      [categoryId]
    );

    if (reports[0].count > 0) {
      // Safe handling: do not delete, deactivate instead to preserve data integrity
      await pool.execute('UPDATE waste_categories SET status = "inactive" WHERE id = ?', [categoryId]);
      return successResponse(res, `Category is referenced by ${reports[0].count} reports. It has been deactivated instead of deleted to protect historical records.`);
    }

    await pool.execute('DELETE FROM waste_categories WHERE id = ?', [categoryId]);
    return successResponse(res, 'Category deleted successfully.');
  } catch (error) {
    console.error('deleteCategory error:', error.message);
    return errorResponse(res, 'Failed to delete category.', 500);
  }
}

module.exports = {
  getActiveCategories,
  getAllCategoriesAdmin,
  createCategory,
  updateCategory,
  deleteCategory
};
