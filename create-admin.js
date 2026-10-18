/**
 * EcoTrack — Setup Admin Account Script
 * Creates an administrator account with a bcrypt-hashed password in the database.
 * Usage:
 *   Interactive: node create-admin.js
 *   Direct:      node create-admin.js "Admin Name" admin@ecotrack.com password123
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const pool = require('./config/database');

async function createAdmin(fullName, email, password) {
  try {
    // Validate inputs
    fullName = fullName?.trim();
    email = email?.trim().toLowerCase();

    if (!fullName || !email || !password) {
      console.error('❌ Error: All fields (name, email, password) are required.');
      process.exit(1);
    }

    if (password.length < 6) {
      console.error('❌ Error: Password must be at least 6 characters long.');
      process.exit(1);
    }

    // Check if user already exists
    const [existing] = await pool.execute('SELECT id, role FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.log(`⚠️ User with email ${email} already exists (Role: ${existing[0].role}).`);
      // Update role to admin and update password
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.execute(
        'UPDATE users SET full_name = ?, password = ?, role = "admin", status = "active" WHERE email = ?',
        [fullName, hashedPassword, email]
      );
      console.log(`✅ User ${email} has been updated to active Administrator successfully.`);
      process.exit(0);
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin user
    const [result] = await pool.execute(
      'INSERT INTO users (full_name, email, password, role, status) VALUES (?, ?, ?, "admin", "active")',
      [fullName, email, hashedPassword]
    );

    console.log('==============================================');
    console.log('✅ Administrator account created successfully!');
    console.log(`👤 Name:   ${fullName}`);
    console.log(`📧 Email:  ${email}`);
    console.log(`🔑 Role:   admin`);
    console.log(`🆔 User ID: ${result.insertId}`);
    console.log('==============================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create administrator:', error.message);
    process.exit(1);
  }
}

// Check if CLI arguments were passed
const args = process.argv.slice(2);
if (args.length >= 3) {
  createAdmin(args[0], args[1], args[2]);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('=== EcoTrack Admin Account Setup ===');
  rl.question('Full Name: ', (fullName) => {
    rl.question('Email Address: ', (email) => {
      rl.question('Password (min 6 characters): ', (password) => {
        rl.close();
        createAdmin(fullName, email, password);
      });
    });
  });
}
