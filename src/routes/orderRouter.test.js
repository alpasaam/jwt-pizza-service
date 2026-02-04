const request = require('supertest');
const app = require('../service');
const { createAdminUser } = require('../testHelpers.js');

let adminUser;
let adminToken;

beforeAll(async () => {
  adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
  adminToken = loginRes.body.token;
});

test('getMenu returns array', async () => {
  const res = await request(app).get('/api/order/menu');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('addMenuItem requires auth', async () => {
  const res = await request(app)
    .put('/api/order/menu')
    .send({ title: 'Test', description: 'd', image: 'i.png', price: 0.01 });
  expect(res.status).toBe(401);
  expect(res.body.message).toBe('unauthorized');
});

test('getOrders requires auth', async () => {
  const res = await request(app).get('/api/order');
  expect(res.status).toBe(401);
  expect(res.body.message).toBe('unauthorized');
});
