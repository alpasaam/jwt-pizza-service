const request = require('supertest');
const app = require('../service');
const { createDinerUser, createAdminUser } = require('../testHelpers.js');

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

test('addMenuItem as admin', async () => {
  const admin = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: admin.email, password: admin.password });
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', 'Bearer ' + loginRes.body.token)
    .send({ title: 'TestPizza', description: 'd', image: 'i.png', price: 0.01 });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('getOrders requires auth', async () => {
  const res = await request(app).get('/api/order');
  expect(res.status).toBe(401);
  expect(res.body.message).toBe('unauthorized');
});

test('getOrders with auth', async () => {
  const diner = await createDinerUser();
  const loginRes = await request(app).put('/api/auth').send({ email: diner.email, password: diner.password });
  const res = await request(app).get('/api/order').set('Authorization', 'Bearer ' + loginRes.body.token);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('orders');
});
