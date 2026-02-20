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

async function createDinerUserWithOrder() {
  const diner = await createDinerUser();
  let menu = await DB.getMenu();
  if (menu.length === 0) {
    await DB.addMenuItem({ title: 'Test', description: 'd', image: 'i.png', price: 0.01 });
    menu = await DB.getMenu();
  }
  const franchisee = await createDinerUser();
  const franchise = await DB.createFranchise({ name: randomName(), admins: [{ email: franchisee.email }] });
  const store = await DB.createStore(franchise.id, { name: 'Store1' });
  await DB.addDinerOrder(diner, {
    franchiseId: franchise.id,
    storeId: store.id,
    items: [{ menuId: menu[0].id, description: 'pizza', price: 0.01 }],
  });
  return diner;
}

module.exports = {
  randomName,
  createAdminUser,
  createDinerUser,
  createDinerUserWithOrder,
};
