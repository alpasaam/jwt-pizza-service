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


