import request from 'supertest';
import { app } from './server.js';
import insforge from './config/insforge.js';

async function runTests() {
  console.log("Starting QA Auth Tests...\n");
  
  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = "Password123!";
  let userToken = "";
  let userRefreshToken = "";

  // 1. Register a new user with valid data
  console.log("Test 1: Register a new user with valid data");
  let res = await request(app).post('/api/user/register').send({
    name: "Test User",
    email: testEmail,
    password: testPassword
  });
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${JSON.stringify(res.body)}`);
  
  // Extract token for later
  if (res.body.token) {
    userToken = res.body.token;
    userRefreshToken = res.body.refreshToken;
  }

  // 2. Register with duplicate email
  console.log("\nTest 2: Register with duplicate email");
  res = await request(app).post('/api/user/register').send({
    name: "Test User Duplicate",
    email: testEmail,
    password: testPassword
  });
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${JSON.stringify(res.body)}`);

  // 3. Register with missing fields (no password)
  console.log("\nTest 3: Register with missing fields");
  res = await request(app).post('/api/user/register').send({
    name: "Test User Missing",
    email: `missing_${Date.now()}@example.com`
  });
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${JSON.stringify(res.body)}`);

  // 4. Login with correct credentials
  console.log("\nTest 4: Login with correct credentials");
  res = await request(app).post('/api/user/login').send({
    email: testEmail,
    password: testPassword
  });
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${JSON.stringify(res.body)}`);

  // 5. Login with wrong password
  console.log("\nTest 5: Login with wrong password");
  res = await request(app).post('/api/user/login').send({
    email: testEmail,
    password: "WrongPassword!"
  });
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${JSON.stringify(res.body)}`);

  // 6. Access a protected route without token
  console.log("\nTest 6: Access a protected route without token");
  // Assuming /api/user/addresses is protected
  res = await request(app).get('/api/user/addresses');
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${JSON.stringify(res.body)}`);

  // 7. Access admin-only route as a regular customer
  console.log("\nTest 7: Access admin-only route as a regular customer");
  // Let's find an admin route. It seems /api/food/add might be admin, or /api/order/list
  res = await request(app).post('/api/food/add').set('token', userToken).send({});
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${JSON.stringify(res.body)}`);

  // 8. Use an expired JWT
  console.log("\nTest 8: Use an expired JWT");
  const jwtModule = await import('jsonwebtoken');
  const jwt = jwtModule.default || jwtModule;
  const expiredToken = jwt.sign({ id: res.body.userId || '123', role: 'user' }, process.env.JWT_SECRET || 'dev_jwt_secret_change_me', { expiresIn: '-1h' });
  res = await request(app).get('/api/user/addresses').set('token', expiredToken);
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${JSON.stringify(res.body)}`);

  // 9. Logout and reuse the old token
  console.log("\nTest 9: Logout and reuse the old token");
  res = await request(app).post('/api/user/logout').set('token', userToken).send({});
  console.log(`Logout Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);
  
  res = await request(app).get('/api/user/addresses').set('token', userToken);
  console.log(`Status after logout: ${res.status}`);
  console.log(`Body after logout: ${JSON.stringify(res.body)}`);

  // Clean up test user
  await insforge.database.from('users').delete().eq('email', testEmail);
  console.log("\nTests Complete and cleaned up.");
  process.exit(0);
}

runTests().catch(console.error);
