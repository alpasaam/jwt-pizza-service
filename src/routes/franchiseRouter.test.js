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

test('createFranchise creates franchise and assigns admin', async () => {
  const name = 'Franchise-' + Math.random().toString(36).substring(2, 12);
  const res = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, admins: [{ email: franchiseeUser.email }] });
  expect(res.status).toBe(200);
  expect(res.body.name).toBe(name);
  expect(res.body.id).toBeDefined();
  expect(res.body.admins).toEqual(expect.arrayContaining([expect.objectContaining({ email: franchiseeUser.email })]));
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


test('getFranchises returns franchises and more flag', async () => {
  const res = await request(app).get('/api/franchise');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('franchises');
  expect(res.body).toHaveProperty('more');
  expect(Array.isArray(res.body.franchises)).toBe(true);
});

test('getUserFranchises requires auth', async () => {
  const res = await request(app).get(`/api/franchise/${franchiseeUser.id}`);
  expect(res.status).toBe(401);
  expect(res.body.message).toBe('unauthorized');
});


test('createStore requires auth', async () => {
  const res = await request(app)
    .post('/api/franchise/1/store')
    .send({ franchiseId: 1, name: 'Store1' });
  expect(res.status).toBe(401);
  expect(res.body.message).toBe('unauthorized');
});

test('createStore creates store for franchise', async () => {
  const name = 'FranchiseForStore-' + Math.random().toString(36).substring(2, 12);
  const createRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, admins: [{ email: franchiseeUser.email }] });
  const franchiseId = createRes.body.id;

  const storeRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ franchiseId, name: 'SLC' });
  expect(storeRes.status).toBe(200);
  expect(storeRes.body.name).toBe('SLC');
  expect(storeRes.body.franchiseId).toBe(franchiseId);
  expect(storeRes.body.id).toBeDefined();
});

test('getUserFranchises returns franchises for user', async () => {
  const name = 'FranchiseForUser-' + Math.random().toString(36).substring(2, 12);
  await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, admins: [{ email: franchiseeUser.email }] });

  const franchiseeLogin = await request(app).put('/api/auth').send({ email: franchiseeUser.email, password: franchiseeUser.password });
  const franchiseeToken = franchiseeLogin.body.token;

  const res = await request(app)
    .get(`/api/franchise/${franchiseeUser.id}`)
    .set('Authorization', `Bearer ${franchiseeToken}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  const found = res.body.find((f) => f.name === name);
  expect(found).toBeDefined();
});

test('deleteStore removes store', async () => {
  const name = 'FranchiseToDeleteStore-' + Math.random().toString(36).substring(2, 12);
  const createRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, admins: [{ email: franchiseeUser.email }] });
  const franchiseId = createRes.body.id;

  const storeRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ franchiseId, name: 'ToDeleteStore' });
  const storeId = storeRes.body.id;

  const deleteRes = await request(app)
    .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body.message).toBe('store deleted');
});

test('deleteFranchise removes franchise', async () => {
  const name = 'ToDelete-' + Math.random().toString(36).substring(2, 12);
  const createRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, admins: [{ email: franchiseeUser.email }] });
  const franchiseId = createRes.body.id;

  const deleteRes = await request(app).delete(`/api/franchise/${franchiseId}`);
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body.message).toBe('franchise deleted');
});