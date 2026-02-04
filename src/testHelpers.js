const { Role, DB } = require('./database/database.js');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';
  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

async function createDinerUser() {
  const password = randomName();
  let user = { name: randomName(), email: randomName() + '@test.com', password, roles: [{ role: Role.Diner }] };
  user = await DB.addUser(user);
  return { ...user, password };
}

module.exports = {
  randomName,
  createAdminUser,
  createDinerUser,
};
