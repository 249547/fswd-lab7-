// node test.js  (uses a temporary database file)
const os = require('os'), path = require('path'), fs = require('fs'), assert = require('assert');
const file = path.join(os.tmpdir(), `shop-test-${Date.now()}.db`);
process.env.DB_FILE = file;
const app = require('./server');

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const call = async (m, p, b) => {
    const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    return { status: r.status, body: await r.json() };
  };
  let r;
  r = await call('GET', '/products'); assert.equal(r.body.total, 3); // seeded Espada Men products
  assert.equal(r.body.data[0].name, 'Classic Formal Suit'); assert.equal(r.body.data[0].price, 24999);
  r = await call('GET', '/categories'); assert.equal(r.body.length, 3);
  r = await call('POST', '/categories', { name: 'Shoes' }); assert.equal(r.status, 201); const cat = r.body.id;
  r = await call('POST', '/categories', { name: 'Shoes' }); assert.equal(r.status, 409);
  r = await call('POST', '/products', { name: 'Runner', price: 50, stock: 5, categoryId: cat }); assert.equal(r.status, 201); const p1 = r.body.id;
  r = await call('POST', '/products', { name: 'Sandal', price: 20, stock: 2 }); const p2 = r.body.id;
  r = await call('POST', '/products', { name: 'X', price: -1 }); assert.equal(r.status, 400);
  r = await call('GET', '/products?search=run'); assert.equal(r.body.total, 1);
  r = await call('GET', '/products?search=shirt'); assert.equal(r.body.total, 1);
  r = await call('GET', `/products?categoryId=${cat}&sort=price_desc`); assert.equal(r.body.data[0].category, 'Shoes');
  r = await call('PATCH', `/products/${p2}`, { price: 25 }); assert.equal(r.body.price, 25); assert.equal(r.body.stock, 2);
  r = await call('POST', '/customers', { name: 'Razi', email: 'r@x.com' }); const cu = r.body.id;
  r = await call('POST', `/customers/${cu}/cart`, { productId: p1, quantity: 2 }); assert.equal(r.status, 201);
  r = await call('POST', `/customers/${cu}/cart`, { productId: p1, quantity: 9 }); assert.equal(r.status, 409);
  r = await call('POST', `/customers/${cu}/cart`, { productId: p2, quantity: 1 });
  assert.equal(r.body.total, 125);
  r = await call('PUT', `/customers/${cu}/cart/${p2}`, { quantity: 2 }); assert.equal(r.body.total, 150);
  r = await call('POST', '/orders', { customerId: cu }); assert.equal(r.status, 201); assert.equal(r.body.total, 150);
  const oid = r.body.id;
  r = await call('GET', `/products/${p1}`); assert.equal(r.body.stock, 3);
  r = await call('GET', `/customers/${cu}/cart`); assert.equal(r.body.items.length, 0);
  r = await call('POST', '/orders', { customerId: cu }); assert.equal(r.status, 400);
  r = await call('PATCH', `/orders/${oid}/status`, { status: 'delivered' }); assert.equal(r.status, 409);
  r = await call('PATCH', `/orders/${oid}/status`, { status: 'paid' }); assert.equal(r.body.status, 'paid');
  r = await call('DELETE', `/orders/${oid}`); assert.equal(r.body.status, 'cancelled');
  r = await call('GET', `/products/${p1}`); assert.equal(r.body.stock, 5);
  r = await call('DELETE', `/customers/${cu}`); assert.equal(r.status, 409);
  r = await call('DELETE', `/categories/${cat}`); r = await call('GET', `/products/${p1}`); assert.equal(r.body.category, null);
  server.close();

  // persistence: open the same file again with a fresh connection
  const Database = require('better-sqlite3');
  const again = new Database(file);
  assert.equal(again.prepare('SELECT COUNT(*) n FROM products').get().n, 5); // 3 seeded + 2 added
  again.close();
  console.log('All Task 2 tests passed (data is persisted in the database file)');
  process.exit(0);
});
