const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool with promise support
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecotrack_db',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00'
});

// Test connection on startup
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'ecotrack_db');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Ensure MySQL/MariaDB is running on port', process.env.DB_PORT || 3306);
  }
}

testConnection();

module.exports = pool;
