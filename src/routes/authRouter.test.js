const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('register returns user and token', async () => {
  const newUser = {
    name: 'fake dude',
    email: Math.random().toString(36).substring(2, 12) + '@test.com',
    password: '329iskindafun',
  };
  const res = await request(app).post('/api/auth').send(newUser);
  expect(res.status).toBe(200);
  expect(res.body.user).toMatchObject({ name: newUser.name, email: newUser.email, roles: [{ role: 'diner' }] });
  expect(res.body.user.password).toBeUndefined();
  expectValidJwt(res.body.token);
});

test('register rejects missing name', async () => {
  const res = await request(app).post('/api/auth').send({ email: Math.random().toString(36).substring(2, 12) + '@test.com', password: 'fakepassword' });
  expect(res.status).toBe(400);
  expect(res.body.message).toBe('name, email, and password are required');
});

test('register rejects missing email', async () => {
  const res = await request(app).post('/api/auth').send({ name: 'fakename', password: 'fakepassword' });
  expect(res.status).toBe(400);
  expect(res.body.message).toBe('name, email, and password are required');
});

test('register rejects missing password', async () => {
  const res = await request(app).post('/api/auth').send({ name: 'fakename', email: Math.random().toString(36).substring(2, 12) + '@test.com' });
  expect(res.status).toBe(400);
  expect(res.body.message).toBe('name, email, and password are required');
});

test('login with wrong password returns 404', async () => {
  const res = await request(app).put('/api/auth').send({ email: testUser.email, password: 'wrongpassword' });
  expect(res.status).toBe(404);
  expect(res.body.message).toBe('unknown user');
});

test('logout', async () => {
  const res = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('logout successful');
});

test('logout without token returns 401', async () => {
  const res = await request(app).delete('/api/auth');
  expect(res.status).toBe(401);
  expect(res.body.message).toBe('unauthorized');
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}