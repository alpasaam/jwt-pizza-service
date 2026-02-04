const request = require('supertest');
const app = require('../service');
const { createAdminUser, createDinerUser } = require('../testHelpers.js');

let adminUser;
let adminToken;
let franchiseeUser;

beforeAll(async () => {
  adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
  adminToken = loginRes.body.token;

  franchiseeUser = await createDinerUser();
});

test('createFranchise requires auth', async () => {
  const res = await request(app)
    .post('/api/franchise')
    .send({ name: 'TestFranchise', admins: [{ email: franchiseeUser.email }] });
  expect(res.status).toBe(401);
  expect(res.body.message).toBe('unauthorized');
});

test('createFranchise requires admin role', async () => {
  const franchiseeLogin = await request(app).put('/api/auth').send({ email: franchiseeUser.email, password: franchiseeUser.password });
  const token = franchiseeLogin.body.token;

  const res = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'TestFranchise', admins: [{ email: franchiseeUser.email }] });
  expect(res.status).toBe(403);
  expect(res.body.message).toBe('unable to create a franchise');
});

