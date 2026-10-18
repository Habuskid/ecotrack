/**
 * EcoTrack — End-to-End System Test Suite
 * Tests authentication, authorization, IDOR protection, workflows,
 * file uploads, admin safeguards, and database integrity.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

// Helper to extract session cookie from Response headers
function getSessionCookie(res) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  return setCookie.split(';')[0];
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting EcoTrack Comprehensive End-to-End Tests');
  console.log('====================================================\n');

  // Create a sample 1x1 test JPEG image buffer
  const sampleImagePath = path.join(__dirname, 'test-sample.jpg');
  // Minimal valid 1x1 JPEG file bytes
  const minimalJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x80, 0xff, 0xd9
  ]);
  fs.writeFileSync(sampleImagePath, minimalJpeg);

  // 1. Public Stats Endpoint
  console.log('--- 1. Testing Public Endpoints ---');
  const pubRes = await fetch(`${BASE_URL}/api/public/stats`);
  const pubData = await pubRes.json();
  assert(pubRes.status === 200 && pubData.success === true, 'GET /api/public/stats returns success');

  // Categories Endpoint
  const catRes = await fetch(`${BASE_URL}/api/categories`);
  const catData = await catRes.json();
  assert(catRes.status === 200 && catData.data.length >= 5, 'GET /api/categories returns seeded categories');
  const plasticCategory = catData.data.find(c => c.name === 'Plastic');

  // 2. Citizen Registration (Alice)
  console.log('\n--- 2. Testing Authentication: Registration ---');
  const uniqueTime = Date.now();
  const aliceEmail = `alice_${uniqueTime}@test.local`;
  const regAliceRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Alice Green',
      email: aliceEmail,
      password: 'password123',
      confirmPassword: 'password123'
    })
  });
  const regAliceData = await regAliceRes.json();
  assert(regAliceRes.status === 201 && regAliceData.success, 'Registration creates new citizen user account');
  let aliceCookie = getSessionCookie(regAliceRes);

  // Duplicate email registration rejection
  const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Alice Clone',
      email: aliceEmail,
      password: 'password123',
      confirmPassword: 'password123'
    })
  });
  assert(dupRes.status === 409, 'Duplicate registration email is rejected with 409 Conflict');

  // 3. Citizen Login & Invalid Credentials
  console.log('\n--- 3. Testing Authentication: Login & Passwords ---');
  // Wrong password
  const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: aliceEmail, password: 'WrongPassword999' })
  });
  const badLoginData = await badLoginRes.json();
  assert(badLoginRes.status === 401 && badLoginData.message === 'Invalid email or password.', 'Invalid credentials rejected with generic error');

  // Correct login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: aliceEmail, password: 'password123' })
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200 && loginData.data.role === 'user', 'Successful login returns citizen role');
  aliceCookie = getSessionCookie(loginRes);

  // Session check (/api/auth/me)
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Cookie': aliceCookie }
  });
  const meData = await meRes.json();
  assert(meData.data.authenticated === true && meData.data.email === aliceEmail, 'GET /api/auth/me confirms active citizen session');

  // 4. Role Authorization Checks
  console.log('\n--- 4. Testing Server-side Role Authorization ---');
  // Citizen attempting to access admin route
  const forbiddenAdminRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { 'Cookie': aliceCookie }
  });
  assert(forbiddenAdminRes.status === 403, 'Citizen account is blocked from Admin endpoints (403 Forbidden)');

  // 5. Register User B (Bob) for IDOR Testing
  console.log('\n--- 5. Testing IDOR & Ownership Protections ---');
  const bobEmail = `bob_${uniqueTime}@test.local`;
  const regBobRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Bob Brown',
      email: bobEmail,
      password: 'password123',
      confirmPassword: 'password123'
    })
  });
  const bobCookie = getSessionCookie(regBobRes);

  // 6. User A (Alice) Submits a Waste Report with File Upload
  console.log('\n--- 6. Testing Waste Report Submission & Multer ---');
  const reportForm = new FormData();
  reportForm.append('categoryId', plasticCategory ? plasticCategory.id : 1);
  reportForm.append('location', 'Maple Street 101, Downtown Park');
  reportForm.append('description', 'Large pile of discarded plastic bottles near the public benches.');
  
  const imgBlob = new Blob([minimalJpeg], { type: 'image/jpeg' });
  reportForm.append('image', imgBlob, 'plastic-waste.jpg');

  const submitReportRes = await fetch(`${BASE_URL}/api/reports`, {
    method: 'POST',
    headers: { 'Cookie': aliceCookie },
    body: reportForm
  });
  const submitReportData = await submitReportRes.json();
  assert(submitReportRes.status === 201 && submitReportData.data.id > 0, 'Alice successfully created report with photo');
  const aliceReportId = submitReportData.data.id;

  // Alice checks her report list
  const aliceListRes = await fetch(`${BASE_URL}/api/reports`, {
    headers: { 'Cookie': aliceCookie }
  });
  const aliceListData = await aliceListRes.json();
  assert(aliceListData.data.some(r => r.id === aliceReportId), 'Alice sees her report in My Reports list');

  // Alice views her own report details
  const aliceDetailRes = await fetch(`${BASE_URL}/api/reports/${aliceReportId}`, {
    headers: { 'Cookie': aliceCookie }
  });
  const aliceDetailData = await aliceDetailRes.json();
  assert(aliceDetailRes.status === 200 && aliceDetailData.data.history.length > 0, 'Alice can view her own report and history log');

  // Bob attempts to view Alice's report (IDOR Attack simulation)
  const bobIdorRes = await fetch(`${BASE_URL}/api/reports/${aliceReportId}`, {
    headers: { 'Cookie': bobCookie }
  });
  assert(bobIdorRes.status === 403, 'IDOR Protection: Bob is blocked from viewing Alice report (403 Forbidden)');

  // 7. Administrator Login & Report Management
  console.log('\n--- 7. Testing Administrator Management & Workflow ---');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ecotrack.local', password: 'Admin@123456' })
  });
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginRes.status === 200 && adminLoginData.data.role === 'admin', 'Admin successfully logs in');
  const adminCookie = getSessionCookie(adminLoginRes);

  // Admin Dashboard Metrics
  const adminDashRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { 'Cookie': adminCookie }
  });
  const adminDashData = await adminDashRes.json();
  assert(adminDashData.data.summary.totalReports >= 1 && adminDashData.data.charts.categories.length > 0, 'Admin dashboard displays real database metrics and chart data');

  // Admin views Alice's report (Legitimate administrative access)
  const adminViewReportRes = await fetch(`${BASE_URL}/api/reports/${aliceReportId}`, {
    headers: { 'Cookie': adminCookie }
  });
  assert(adminViewReportRes.status === 200, 'Admin can legitimately inspect citizen report');

  // 8. Workflow Status Transitions & Validation
  console.log('\n--- 8. Testing Valid & Invalid Status Transitions ---');
  // Attempt invalid transition: Pending -> Collected directly
  const badTransitionRes = await fetch(`${BASE_URL}/api/admin/reports/${aliceReportId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({ status: 'Collected', note: 'Skipping steps illegally' })
  });
  assert(badTransitionRes.status === 400, 'Server rejects invalid workflow transition (Pending -> Collected directly)');

  // Valid transition 1: Pending -> Approved
  const approveRes = await fetch(`${BASE_URL}/api/admin/reports/${aliceReportId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({ status: 'Approved', note: 'Photo evidence verified by municipal supervisor.' })
  });
  const approveData = await approveRes.json();
  assert(approveRes.status === 200 && approveData.success, 'Report successfully transitioned: Pending -> Approved');

  // 9. Collection Management
  console.log('\n--- 9. Testing Collection Scheduling & Completion ---');
  const scheduleRes = await fetch(`${BASE_URL}/api/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({
      reportId: aliceReportId,
      scheduledDate: '2026-10-25',
      notes: 'Truck #4 morning route assigned'
    })
  });
  const schedData = await scheduleRes.json();
  assert(scheduleRes.status === 200 && schedData.success, 'Admin scheduled collection and report advanced to In Progress');

  // Mark collection complete
  const completeRes = await fetch(`${BASE_URL}/api/collections/${aliceReportId}/complete`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({ notes: 'Waste truck loaded and area swept.' })
  });
  assert(completeRes.status === 200, 'Collection marked complete and report transitioned to Collected');

  // Verify full audit log
  const verifyHistoryRes = await fetch(`${BASE_URL}/api/reports/${aliceReportId}`, {
    headers: { 'Cookie': adminCookie }
  });
  const verifyHistoryData = await verifyHistoryRes.json();
  assert(verifyHistoryData.data.status === 'Collected' && verifyHistoryData.data.history.length >= 3, 'Audit trail contains complete status transition history');

  // 10. Admin User Management & Safeguards
  console.log('\n--- 10. Testing Admin User Management & Safeguards ---');
  // Attempt to deactivate the only active admin
  const deactAdminRes = await fetch(`${BASE_URL}/api/admin/users/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({ status: 'inactive' })
  });
  assert(deactAdminRes.status === 403, 'Safeguard: Server blocks deactivating the only active administrator');

  // Deactivate Bob (regular user)
  const deactBobRes = await fetch(`${BASE_URL}/api/admin/users/${regBobRes.status === 201 ? (await fetch(`${BASE_URL}/api/auth/me`, { headers: { 'Cookie': bobCookie } }).then(r=>r.json())).data.id : 2}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({ status: 'inactive' })
  });
  assert(deactBobRes.status === 200, 'Admin can successfully deactivate a normal citizen user');

  // 11. Category Management
  console.log('\n--- 11. Testing Category Management ---');
  const newCatName = `Battery_${uniqueTime}`;
  const addCatRes = await fetch(`${BASE_URL}/api/admin/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({
      name: newCatName,
      description: 'Used lithium and alkaline batteries',
      disposalMethod: 'Deposit at municipal battery recycling box.'
    })
  });
  assert(addCatRes.status === 201, 'Admin can create a new waste category');

  // 12. AI Recognition Feature (Unconfigured State Check)
  console.log('\n--- 12. Testing AI Recognition Model Behavior ---');
  const aiForm = new FormData();
  aiForm.append('image', imgBlob, 'ai-test.jpg');
  const aiRes = await fetch(`${BASE_URL}/api/recognition`, {
    method: 'POST',
    headers: { 'Cookie': aliceCookie },
    body: aiForm
  });
  const aiData = await aiRes.json();
  assert(aiData.available === false && aiData.message.includes('Waste recognition is currently unavailable'), 'AI returns honest unavailable state without random predictions');

  // 13. Profile Update & Password Change
  console.log('\n--- 13. Testing Profile & Password Change ---');
  const updateProfRes = await fetch(`${BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': aliceCookie },
    body: JSON.stringify({ fullName: 'Alice Green Updated', email: aliceEmail })
  });
  assert(updateProfRes.status === 200, 'Citizen can update profile name');

  const changePwRes = await fetch(`${BASE_URL}/api/users/change-password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': aliceCookie },
    body: JSON.stringify({
      currentPassword: 'password123',
      newPassword: 'newSecurePassword456',
      confirmPassword: 'newSecurePassword456'
    })
  });
  assert(changePwRes.status === 200, 'Citizen can change password with current password verification');

  // Verify login with new password
  const newPwLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: aliceEmail, password: 'newSecurePassword456' })
  });
  assert(newPwLoginRes.status === 200, 'Citizen can log in with updated password');

  // Clean up test sample file
  if (fs.existsSync(sampleImagePath)) {
    fs.unlinkSync(sampleImagePath);
  }

  console.log('\n====================================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Tests Passed`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL SYSTEM REQUIREMENTS AND SAFETY CHECKS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
