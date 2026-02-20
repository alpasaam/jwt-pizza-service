const request = require('supertest');
const app = require('../service');
const { createDinerUser, createAdminUser } = require('../testHelpers.js');

let dinerUser;
let dinerToken;

beforeAll(async () => {
  dinerUser = await createDinerUser();
  const dinerLogin = await request(app).put('/api/auth').send({ email: dinerUser.email, password: dinerUser.password });
  dinerToken = dinerLogin.body.token;
});

test('get /me requires auth', async () => {
  const res = await request(app).get('/api/user/me');
  expect(res.status).toBe(401);
  expect(res.body.message).toBe('unauthorized');
});

test('get /me returns current user', async () => {
  const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${dinerToken}`);
  expect(res.status).toBe(200);
  expect(res.body.id).toBe(dinerUser.id);
  expect(res.body.email).toBe(dinerUser.email);
  expect(res.body.name).toBe(dinerUser.name);
  expect(res.body.roles).toEqual([{ role: 'diner' }]);
});

test('updateUser allows user to update self', async () => {
  const newName = Math.random().toString(36).substring(2, 12);
  const res = await request(app)
    .put(`/api/user/${dinerUser.id}`)
    .set('Authorization', `Bearer ${dinerToken}`)
    .send({ name: newName, email: dinerUser.email });
  expect(res.status).toBe(200);
  expect(res.body.user.name).toBe(newName);
  expect(res.body.token).toBeDefined();
});

test('updateUser forbidden when diner updates another user', async () => {
  const otherUser = await createDinerUser();
  const res = await request(app)
    .put(`/api/user/${otherUser.id}`)
    .set('Authorization', `Bearer ${dinerToken}`)
    .send({ name: 'other', email: otherUser.email });
  expect(res.status).toBe(403);
});

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users forbidden for diner', async () => {
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + dinerToken);
  expect(listUsersRes.status).toBe(403);
});

test('list users', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
  const adminToken = loginRes.body.token;
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + adminToken);
  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body).toHaveProperty('users');
  expect(Array.isArray(listUsersRes.body.users)).toBe(true);
  expect(listUsersRes.body).toHaveProperty('more');
  expect(listUsersRes.body.users.length).toBeGreaterThanOrEqual(1);
  const first = listUsersRes.body.users[0];
  expect(first).toHaveProperty('id');
  expect(first).toHaveProperty('name');
  expect(first).toHaveProperty('email');
  expect(first).toHaveProperty('roles');
  expect(first).not.toHaveProperty('password');
});

test('list users filters by name', async () => {
  await request(app).post('/api/auth').send({ name: 'testName', email: randomName() + '@test.com', password: 'p' });
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
  const adminToken = loginRes.body.token;
  const listUsersRes = await request(app)
    .get('/api/user?name=testName')
    .set('Authorization', 'Bearer ' + adminToken);
  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body.users.some((u) => u.name === 'testName')).toBe(true);
  expect(listUsersRes.body.users.every((u) => u.name.includes('testName'))).toBe(true);
});

test('delete user unauthorized', async () => {
  const res = await request(app).delete(`/api/user/${dinerUser.id}`);
  expect(res.status).toBe(401);
});

test('delete user forbidden for diner', async () => {
  const res = await request(app)
    .delete(`/api/user/${dinerUser.id}`)
    .set('Authorization', 'Bearer ' + dinerToken);
  expect(res.status).toBe(403);
});

test('delete user', async () => {
  const toDelete = await createDinerUser();
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
  const adminToken = loginRes.body.token;
  const res = await request(app)
    .delete(`/api/user/${toDelete.id}`)
    .set('Authorization', 'Bearer ' + adminToken);
  expect(res.status).toBe(200);
  const listRes = await request(app).get('/api/user').set('Authorization', 'Bearer ' + adminToken);
  expect(listRes.body.users.some((u) => u.id === toDelete.id)).toBe(false);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

