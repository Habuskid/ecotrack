# EcoTrack — Smart Waste Management System

> **Tagline:** Smart Waste Management for a Cleaner Tomorrow.  
> **Hero:** Smarter Waste Management. Cleaner Communities.

EcoTrack is a full-stack smart waste management and incident reporting system built as a final-year academic project. The application connects community residents with municipal waste management authorities, enabling image-based waste identification, location-tagged problem reporting, and transparent collection tracking.

---

## 1. Project Overview

Municipalities frequently encounter overflowing dumpsters, uncollected debris, and hazardous waste disposal violations. EcoTrack solves this through a lightweight, robust platform:

1. **Citizens** capture or upload photos of waste items, analyze their recyclability with an integrated AI vision model, file location-tagged waste reports, and track collection progress.
2. **Municipal Administrators** review reports, inspect photo evidence, enforce legitimate status transitions (`Pending` → `Approved` → `In Progress` → `Collected`), schedule collection truck pickups, manage waste categories, and monitor live city analytics with interactive charts.

---

## 2. Technology Stack

Built with a simple, modern JavaScript stack designed for high performance, easy maintainability, and clear explanation during a university project defense:

### Frontend
- **HTML5 & CSS3:** Semantic markup and custom modern environmental design tokens.
- **Vanilla JavaScript (ES6+):** Clean client-side architecture using standard DOM APIs and the native `Fetch API` (no heavy frontend frameworks like React or Vue).
- **Bootstrap 5 (5.3.3):** Responsive grid layout, modals, dropdowns, and components.
- **Bootstrap Icons (1.11.3):** Standardized UI iconography.
- **Chart.js (4.4.4):** Interactive live data visualizations for waste categories and workflow statuses.

### Backend
- **Node.js:** Fast, asynchronous JavaScript runtime.
- **Express.js:** Minimalist, flexible web routing and RESTful API framework.
- **Express Sessions (`express-session`):** Secure server-side user session management with `httpOnly` and `sameSite` cookies.
- **bcrypt (`bcryptjs`):** Industry-standard salted password hashing (salt rounds = 10).
- **Multer:** Secure multipart form data and file upload handler with MIME type, extension, and file size validation.

### Database
- **MySQL / MariaDB:** Relational database with InnoDB engine and `utf8mb4` encoding.
- **`mysql2`:** Direct Node.js driver utilizing connection pooling and parameterized SQL queries. **No ORMs** (Prisma, Sequelize, or TypeORM) were used so that the SQL logic remains completely transparent and easy for a student to defend.

### AI Waste Recognition
- **Google Gemini Vision API:** Genuine multimodal AI classifier classifying waste into **Plastic, Paper, Metal, Glass,** and **Organic Waste**.
- **Zero Fabrication Principle:** The system **never** invents fake predictions or uses `Math.random()`. If the AI model is unconfigured or unavailable, it explicitly presents a clear notice and allows the user to manually select the category.

---

## 3. System Architecture & Project Structure

```text
ecotrack/
│
├── server.js                      # Main Express server and application entrypoint
├── create-admin.js                # CLI script to securely create administrator accounts
├── package.json                   # Dependencies, scripts, and project metadata
├── .env                           # Environment configuration
├── .env.example                   # Template for environment variables
├── README.md                      # Comprehensive documentation and defense guide
│
├── config/
│   └── database.js                # mysql2 connection pool and connection test
│
├── middleware/
│   ├── auth.js                    # requireLogin, requireAdmin, and page route guards
│   └── upload.js                  # Multer secure image upload handler
│
├── routes/
│   ├── auth.js                    # /api/auth (register, login, logout, me)
│   ├── users.js                   # /api/users (profile, password changes)
│   ├── reports.js                 # /api/reports (submit, list, detail)
│   ├── categories.js              # /api/categories (active categories)
│   ├── collections.js             # /api/collections (schedule, complete pickup)
│   ├── recognition.js             # /api/recognition (AI classification)
│   └── admin.js                   # /api/admin (analytics, workflow, users)
│
├── controllers/
│   ├── authController.js          # Authentication business logic & bcrypt hashing
│   ├── userController.js          # Citizen profile & password updates
│   ├── reportController.js        # Report creation transactions & IDOR protection
│   ├── categoryController.js      # Category CRUD & safe deactivation handling
│   ├── collectionController.js    # Pickup scheduling and completion records
│   ├── recognitionController.js   # Genuine Gemini vision model classifier
│   └── adminController.js         # Operations dashboard & status transition rules
│
├── utils/
│   ├── validation.js              # Email, password, and workflow state validators
│   └── helpers.js                 # Standardized JSON response formatting
│
├── database/
│   └── ecotrack.sql               # Database schema and initial category seed data
│
├── uploads/
│   └── waste/                     # Validated uploaded waste incident photos
│
├── tests/
│   └── test-suite.js              # Automated end-to-end integration test suite
│
└── public/
    ├── index.html                 # Public landing page with live database statistics
    ├── login.html                 # Login page with show/hide password toggle
    ├── register.html              # Citizen account registration
    │
    ├── user/                      # Protected Citizen Views
    │   ├── dashboard.html         # Citizen dashboard & recent reports
    │   ├── identify-waste.html    # AI Waste recognition scanner & dropzone
    │   ├── report-waste.html      # Waste reporting form with photo upload & GPS
    │   ├── my-reports.html        # Citizen report history with search/filter
    │   ├── report-details.html    # Detailed report status & audit timeline
    │   └── profile.html           # Profile settings & password change
    │
    ├── admin/                     # Protected Administrator Views
    │   ├── dashboard.html         # Live analytics, Chart.js graphs, counters
    │   ├── reports.html           # Report workflow management & action buttons
    │   ├── report-details.html    # Detailed review, admin notes & schedule link
    │   ├── users.html             # User directory & activation toggle
    │   ├── categories.html        # Category manager & disposal guide editor
    │   └── collections.html       # Pickup scheduling & completion tracking
    │
    ├── css/
    │   ├── style.css              # Global tokens, theme colors, typography
    │   ├── auth.css               # Authentication cards & inputs
    │   └── dashboard.css          # Responsive sidebar layout & timeline styles
    │
    └── js/
        ├── app.js                 # Shared frontend logic, toast alerts, auth check
        ├── auth.js                # Registration & login form handlers
        ├── dashboard.js           # Citizen dashboard counters & recent table
        ├── reports.js             # Waste report submission, filters, detail view
        ├── recognition.js         # Drag-and-drop file upload & AI handler
        └── admin.js               # Admin charts, status transitions, collections
```

---

## 4. Database Design (`ecotrack_db`)

The database uses MySQL/MariaDB with the InnoDB storage engine for foreign keys and ACID transactions:

1. **`users`:** Stores citizen and administrator accounts. Passwords are saved strictly as bcrypt hashes.
2. **`waste_categories`:** Stores standard waste types (`Plastic`, `Paper`, `Metal`, `Glass`, `Organic Waste`) and recommended disposal instructions.
3. **`waste_reports`:** Stores waste reports submitted by citizens, including foreign keys to `users` and `waste_categories`, file path, location, and status.
4. **`recognition_results`:** Stores genuine predictions from the AI recognition tool, recording the predicted category, confidence score, and uploaded photo.
5. **`collection_records`:** Stores scheduled collection dates, completion timestamps, and operational truck notes.
6. **`report_status_history`:** Stores an immutable audit trail of every status transition (`old_status` → `new_status`), who changed it, and why.

---

## 5. Security & Academic Defense Topics

During your project defense, examiners typically ask about security, architecture, and design decisions:

### How does authentication work?
1. The user enters their email and password.
2. The server queries the database for the user record.
3. `bcrypt.compare()` compares the plaintext password against the salted bcrypt hash.
4. If valid, an Express session is established and a signed session ID (`connect.sid`) is returned in an `HttpOnly`, `SameSite=Lax` cookie.
5. On subsequent requests, the `requireLogin` middleware inspects `req.session.userId`.

### How is authorization enforced?
- **Server-Side Enforcement:** Protection is not left to frontend JavaScript. Middleware (`requireLogin` and `requireAdmin`) intercepts requests before any page or API data is returned.
- **IDOR Protection:** When a citizen requests `/api/reports/:id`, the query verifies that `report.user_id === req.session.userId`. If a user attempts to change the URL to view another citizen's report, the server returns `403 Forbidden`.
- **Last Active Administrator Safeguard:** An administrator cannot deactivate their own or another administrator account if it is the only remaining active admin account.

### How do database transactions protect data integrity?
When a report is created:
1. `connection.beginTransaction()` starts an atomic transaction.
2. The report is inserted into `waste_reports`.
3. An audit record is simultaneously inserted into `report_status_history`.
4. If either step fails, `connection.rollback()` reverts all changes, preventing orphaned records.
5. `connection.commit()` commits the transaction.

### What is the valid report status workflow?
Status transitions are strictly validated on the server using `isValidStatusTransition()`:
- `Pending` → `Approved` or `Rejected`
- `Approved` → `In Progress` or `Rejected`
- `In Progress` → `Collected`
- Arbitrary jumps (e.g. attempting to jump from `Pending` directly to `Collected`) are rejected by the server with `400 Bad Request`.

### How does the AI Waste Recognition feature work?
- The user uploads or captures a photo.
- If a genuine vision model API key (`GEMINI_API_KEY`) is configured in `.env`, the server performs multimodal classification using Google Gemini, extracting category, confidence percentage, and disposal advice.
- **If no key is configured or the service is offline:** The system explicitly returns:
  `"Waste recognition is currently unavailable. Please select the waste category manually."`
  The user is seamlessly routed to manual category selection with their photo preserved.

---

## 6. Installation & Setup Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18, v20, or v22)
- [MySQL](https://www.mysql.com/) or [MariaDB](https://mariadb.org/)
- `npm`

### Step 1: Install Dependencies
Navigate to the project root and install the required npm packages:
```bash
npm install
```

### Step 2: Configure Environment Variables
Create your local `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Ensure your database credentials in `.env` match your MySQL setup:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=ecotrack_db
DB_PORT=3306

PORT=3000
SESSION_SECRET=ecotrack_super_secure_academic_defense_key
NODE_ENV=development

# Optional: Set your Gemini API key to enable genuine AI waste classification
GEMINI_API_KEY=
```

### Step 3: Import Database Schema
Import the database script into your MySQL server:
```bash
mysql -u root -p < database/ecotrack.sql
```
*(If your root user has no password, omit `-p`)*

This creates the `ecotrack_db` database, all 6 tables with foreign keys, and seeds the 5 initial active waste categories.

### Step 4: Create Administrator Account
Run the included setup script:
```bash
node create-admin.js
```
The script will prompt for:
- Full Name: `System Administrator`
- Email: `admin@ecotrack.local`
- Password: `Admin@123456`

*(You can also pass arguments directly: `node create-admin.js "Admin Name" admin@ecotrack.local Admin@123456`)*

### Step 5: Start the Application
Run the start command:
```bash
npm start
```
For automatic reloading during development:
```bash
npm run dev
```

Visit the application in your browser:
- **Landing Page:** [http://localhost:3000](http://localhost:3000)
- **Login:** [http://localhost:3000/login.html](http://localhost:3000/login.html)
- **Register:** [http://localhost:3000/register.html](http://localhost:3000/register.html)

---

## 7. Running the Automated Test Suite

EcoTrack includes an end-to-end integration test suite verifying 27 safety and functional checkpoints (authentication, rate limiting, role authorization, IDOR protection, Multer image uploads, status workflow state transitions, admin safeguards, and category management):

```bash
npm test
```

Expected output:
```text
====================================================
🧪 Starting EcoTrack Comprehensive End-to-End Tests
====================================================
  ✅ PASS: GET /api/public/stats returns success
  ✅ PASS: GET /api/categories returns seeded categories
  ✅ PASS: Registration creates new citizen user account
  ✅ PASS: Duplicate registration email is rejected with 409 Conflict
  ✅ PASS: Invalid credentials rejected with generic error
  ✅ PASS: Successful login returns citizen role
  ✅ PASS: GET /api/auth/me confirms active citizen session
  ✅ PASS: Citizen account is blocked from Admin endpoints (403 Forbidden)
  ✅ PASS: Alice successfully created report with photo
  ✅ PASS: Alice sees her report in My Reports list
  ✅ PASS: Alice can view her own report and history log
  ✅ PASS: IDOR Protection: Bob is blocked from viewing Alice report (403 Forbidden)
  ✅ PASS: Admin successfully logs in
  ✅ PASS: Admin dashboard displays real database metrics and chart data
  ✅ PASS: Admin can legitimately inspect citizen report
  ✅ PASS: Server rejects invalid workflow transition (Pending -> Collected directly)
  ✅ PASS: Report successfully transitioned: Pending -> Approved
  ✅ PASS: Admin scheduled collection and report advanced to In Progress
  ✅ PASS: Collection marked complete and report transitioned to Collected
  ✅ PASS: Audit trail contains complete status transition history
  ✅ PASS: Safeguard: Server blocks deactivating the only active administrator
  ✅ PASS: Admin can successfully deactivate a normal citizen user
  ✅ PASS: Admin can create a new waste category
  ✅ PASS: AI returns honest unavailable state without random predictions
  ✅ PASS: Citizen can update profile name
  ✅ PASS: Citizen can change password with current password verification
  ✅ PASS: Citizen can log in with updated password
====================================================
📊 Test Results: 27/27 Tests Passed
====================================================
🎉 ALL SYSTEM REQUIREMENTS AND SAFETY CHECKS PASSED!
```

---

## 8. Troubleshooting

| Issue | Likely Cause | Solution |
| :--- | :--- | :--- |
| `Database connection failed: connect ECONNREFUSED` | MySQL/MariaDB service is not running on port 3306. | Start MySQL/MariaDB service or check port in `.env`. |
| `Access denied for user 'root'@'localhost'` | MySQL root password in `.env` is incorrect. | Update `DB_PASSWORD` in `.env` to match your MySQL root password. |
| `Only JPEG, PNG, and WebP image formats are accepted` | Uploaded file has an unsupported extension or MIME type. | Ensure your image is a standard `.jpg`, `.png`, or `.webp` file under 5MB. |
| `AI Waste Recognition unavailable notice` | `GEMINI_API_KEY` is not defined in `.env`. | Add a free Gemini API key to `.env` if you wish to run live computer vision, or continue with manual selection. |
| `Cannot deactivate the only remaining active administrator` | Safety rule preventing lock-out. | You cannot deactivate an admin when they are the sole administrator account. |

---

## 9. Academic License

Built for university academic presentation, coursework assessment, and project defense. Released under the MIT License.
