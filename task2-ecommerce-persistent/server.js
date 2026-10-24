const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const isInt = (v) => Number.isInteger(v);
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const uniqueError = (e) => e && e.code === 'SQLITE_CONSTRAINT_UNIQUE';

app.get('/', (req, res) => res.json({
  message: 'Espada Men - Store API (persistent, SQLite)',
  endpoints: ['/categories', '/products', '/customers', '/customers/:id/cart', '/orders'],
}));

/* =========================== CATEGORIES =========================== */
app.post('/categories', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') return bad(res, 'name is required');
  try {
    const r = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { if (uniqueError(e)) return bad(res, 'Category already exists', 409); throw e; }
});

app.get('/categories', (req, res) => res.json(db.prepare('SELECT * FROM categories ORDER BY name').all()));

app.get('/categories/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!c) return bad(res, 'Category not found', 404);
  res.json(c);
});

app.put('/categories/:id', (req, res) => {
  const { name } = req.body;
  if (!name) return bad(res, 'name is required');
  try {
    const r = db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    if (!r.changes) return bad(res, 'Category not found', 404);
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
  } catch (e) { if (uniqueError(e)) return bad(res, 'Category already exists', 409); throw e; }
});

app.delete('/categories/:id', (req, res) => {
  const r = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (!r.changes) return bad(res, 'Category not found', 404);
  res.json({ message: 'Category deleted (its products are kept without a category)' });
});

/* ============================ PRODUCTS ============================ */
const PRODUCT_SELECT = `SELECT p.*, c.name AS category FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

function checkProduct(b, partial) {
  if (!partial || b.name !== undefined) if (!b.name || typeof b.name !== 'string') return 'name is required';
  if (!partial || b.price !== undefined) if (typeof b.price !== 'number' || b.price < 0) return 'price must be a number >= 0';
  if (b.stock !== undefined && (!isInt(b.stock) || b.stock < 0)) return 'stock must be a whole number >= 0';
  if (b.categoryId !== undefined && b.categoryId !== null &&
      !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(b.categoryId)) return `Category ${b.categoryId} does not exist`;
  return null;
}

app.post('/products', (req, res) => {
  const err = checkProduct(req.body, false);
  if (err) return bad(res, err);
  const { name, description = '', price, stock = 0, imageUrl = '', categoryId = null } = req.body;
  const r = db.prepare('INSERT INTO products (name, description, price, stock, image_url, category_id) VALUES (?,?,?,?,?,?)')
    .run(name.trim(), description, price, stock, imageUrl, categoryId);
  res.status(201).json(db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(r.lastInsertRowid));
});

// GET /products?search=&categoryId=&minPrice=&maxPrice=&inStock=true&sort=price_asc&page=1&limit=10
app.get('/products', (req, res) => {
  const { search, categoryId, minPrice, maxPrice, inStock, sort } = req.query;
  const where = []; const args = [];
  if (search) { where.push('(p.name LIKE ? OR p.description LIKE ?)'); args.push(`%${search}%`, `%${search}%`); }
  if (categoryId) { where.push('p.category_id = ?'); args.push(categoryId); }
  if (minPrice) { where.push('p.price >= ?'); args.push(Number(minPrice)); }
  if (maxPrice) { where.push('p.price <= ?'); args.push(Number(maxPrice)); }
  if (inStock === 'true') where.push('p.stock > 0');
  const sorts = { price_asc: 'p.price ASC', price_desc: 'p.price DESC', name: 'p.name ASC', newest: 'p.id DESC' };
  const order = sorts[sort] || 'p.id ASC';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) n FROM products p ${w}`).get(...args).n;
  const data = db.prepare(`${PRODUCT_SELECT} ${w} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit);
  res.json({ page, limit, total, data });
});

app.get('/products/:id', (req, res) => {
  const p = db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(req.params.id);
  if (!p) return bad(res, 'Product not found', 404);
  res.json(p);
});

function updateProduct(partial) {
  return (req, res) => {
    const old = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!old) return bad(res, 'Product not found', 404);
    const err = checkProduct(req.body, partial);
    if (err) return bad(res, err);
    const b = req.body;
    const next = {
      name: b.name !== undefined ? b.name.trim() : old.name,
      description: b.description !== undefined ? b.description : (partial ? old.description : ''),
      price: b.price !== undefined ? b.price : old.price,
      stock: b.stock !== undefined ? b.stock : (partial ? old.stock : 0),
      image_url: b.imageUrl !== undefined ? b.imageUrl : (partial ? old.image_url : ''),
      category_id: b.categoryId !== undefined ? b.categoryId : (partial ? old.category_id : null),
    };
    db.prepare('UPDATE products SET name=?, description=?, price=?, stock=?, image_url=?, category_id=? WHERE id=?')
      .run(next.name, next.description, next.price, next.stock, next.image_url, next.category_id, old.id);
    res.json(db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(old.id));
  };
}
app.put('/products/:id', updateProduct(false));
app.patch('/products/:id', updateProduct(true));

app.delete('/products/:id', (req, res) => {
  const r = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!r.changes) return bad(res, 'Product not found', 404);
  res.json({ message: 'Product deleted' });
});

/* =========================== CUSTOMERS =========================== */
app.post('/customers', (req, res) => {
  const { name, email, address = '' } = req.body;
  if (!name) return bad(res, 'name is required');
  if (!isEmail(email)) return bad(res, 'valid email is required');
  try {
    const r = db.prepare('INSERT INTO customers (name, email, address) VALUES (?,?,?)').run(name, email, address);
    res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { if (uniqueError(e)) return bad(res, 'Email already registered', 409); throw e; }
});

app.get('/customers', (req, res) => res.json(db.prepare('SELECT * FROM customers ORDER BY id').all()));

app.get('/customers/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return bad(res, 'Customer not found', 404);
  res.json(c);
});

app.put('/customers/:id', (req, res) => {
  const { name, email, address = '' } = req.body;
  if (!name) return bad(res, 'name is required');
  if (!isEmail(email)) return bad(res, 'valid email is required');
  try {
    const r = db.prepare('UPDATE customers SET name=?, email=?, address=? WHERE id=?').run(name, email, address, req.params.id);
    if (!r.changes) return bad(res, 'Customer not found', 404);
    res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
  } catch (e) { if (uniqueError(e)) return bad(res, 'Email already registered', 409); throw e; }
});

app.delete('/customers/:id', (req, res) => {
  if (db.prepare('SELECT 1 FROM orders WHERE customer_id = ?').get(req.params.id))
    return bad(res, 'Customer has orders and cannot be deleted', 409);
  const r = db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  if (!r.changes) return bad(res, 'Customer not found', 404);
  res.json({ message: 'Customer deleted' });
});

/* ============================== CART ============================== */
const customerOr404 = (req, res, next) => {
  if (!db.prepare('SELECT 1 FROM customers WHERE id = ?').get(req.params.id)) return bad(res, 'Customer not found', 404);
  next();
};

function readCart(customerId) {
  const items = db.prepare(`
    SELECT ci.product_id AS productId, p.name, p.price, ci.quantity, p.stock, p.price * ci.quantity AS subtotal
    FROM cart_items ci JOIN products p ON p.id = ci.product_id
    WHERE ci.customer_id = ? ORDER BY ci.id`).all(customerId);
  return { customerId: Number(customerId), items, total: +items.reduce((s, i) => s + i.subtotal, 0).toFixed(2) };
}

app.get('/customers/:id/cart', customerOr404, (req, res) => res.json(readCart(req.params.id)));

// add product (quantity is added to what is already in the cart)
app.post('/customers/:id/cart', customerOr404, (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!isInt(productId)) return bad(res, 'productId is required');
  if (!isInt(quantity) || quantity < 1) return bad(res, 'quantity must be a whole number >= 1');
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!p) return bad(res, 'Product not found', 404);
  const have = db.prepare('SELECT quantity FROM cart_items WHERE customer_id=? AND product_id=?').get(req.params.id, productId);
  const newQty = (have ? have.quantity : 0) + quantity;
  if (newQty > p.stock) return bad(res, `Only ${p.stock} in stock`, 409);
  db.prepare(`INSERT INTO cart_items (customer_id, product_id, quantity) VALUES (?,?,?)
              ON CONFLICT(customer_id, product_id) DO UPDATE SET quantity = excluded.quantity`).run(req.params.id, productId, newQty);
  res.status(201).json(readCart(req.params.id));
});

app.put('/customers/:id/cart/:productId', customerOr404, (req, res) => {
  const { quantity } = req.body;
  if (!isInt(quantity) || quantity < 1) return bad(res, 'quantity must be a whole number >= 1');
  const p = db.prepare('SELECT stock FROM products WHERE id = ?').get(req.params.productId);
  if (!p) return bad(res, 'Product not found', 404);
  if (quantity > p.stock) return bad(res, `Only ${p.stock} in stock`, 409);
  const r = db.prepare('UPDATE cart_items SET quantity=? WHERE customer_id=? AND product_id=?').run(quantity, req.params.id, req.params.productId);
  if (!r.changes) return bad(res, 'Product is not in the cart', 404);
  res.json(readCart(req.params.id));
});

app.delete('/customers/:id/cart/:productId', customerOr404, (req, res) => {
  const r = db.prepare('DELETE FROM cart_items WHERE customer_id=? AND product_id=?').run(req.params.id, req.params.productId);
  if (!r.changes) return bad(res, 'Product is not in the cart', 404);
  res.json(readCart(req.params.id));
});

app.delete('/customers/:id/cart', customerOr404, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE customer_id = ?').run(req.params.id);
  res.json(readCart(req.params.id));
});

/* ============================= ORDERS ============================= */
const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
const NEXT = { pending: ['paid', 'cancelled'], paid: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };

function readOrder(id) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!o) return null;
  o.items = db.prepare('SELECT product_id AS productId, name, price, quantity FROM order_items WHERE order_id = ?').all(id);
  return o;
}

// all-or-nothing: if anything fails, nothing is saved
const checkout = db.transaction((customerId) => {
  const items = db.prepare(`SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock
    FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.customer_id = ?`).all(customerId);
  if (!items.length) throw Object.assign(new Error('Cart is empty'), { status: 400 });
  for (const i of items) {
    if (i.quantity > i.stock) throw Object.assign(new Error(`Not enough stock for "${i.name}" (only ${i.stock} left)`), { status: 409 });
  }
  const total = +items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2);
  const orderId = db.prepare('INSERT INTO orders (customer_id, total) VALUES (?, ?)').run(customerId, total).lastInsertRowid;
  const addItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?,?,?,?,?)');
  const reduce = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
  for (const i of items) { addItem.run(orderId, i.product_id, i.name, i.price, i.quantity); reduce.run(i.quantity, i.product_id); }
  db.prepare('DELETE FROM cart_items WHERE customer_id = ?').run(customerId);
  return orderId;
});

// place order from the customer's cart
app.post('/orders', (req, res) => {
  const { customerId } = req.body;
  if (!isInt(customerId)) return bad(res, 'customerId is required');
  if (!db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customerId)) return bad(res, 'Customer not found', 404);
  const id = checkout(customerId);
  res.status(201).json(readOrder(id));
});

app.get('/orders', (req, res) => {
  const where = []; const args = [];
  if (req.query.customerId) { where.push('customer_id = ?'); args.push(req.query.customerId); }
  if (req.query.status) { where.push('status = ?'); args.push(req.query.status); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  res.json(db.prepare(`SELECT * FROM orders ${w} ORDER BY id DESC`).all(...args));
});

app.get('/orders/:id', (req, res) => {
  const o = readOrder(req.params.id);
  if (!o) return bad(res, 'Order not found', 404);
  res.json(o);
});

const setStatus = db.transaction((id, status) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!o) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (!NEXT[o.status].includes(status))
    throw Object.assign(new Error(`Cannot change order from "${o.status}" to "${status}"`), { status: 409 });
  if (status === 'cancelled') {  // put the stock back
    const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id);
    for (const i of items) if (i.product_id) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(i.quantity, i.product_id);
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
});

app.patch('/orders/:id/status', (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return bad(res, `status must be one of: ${STATUSES.join(', ')}`);
  setStatus(req.params.id, status);
  res.json(readOrder(req.params.id));
});

app.delete('/orders/:id', (req, res) => {   // DELETE = cancel
  setStatus(req.params.id, 'cancelled');
  res.json(readOrder(req.params.id));
});

/* ============================ fallbacks ============================ */
app.use((req, res) => bad(res, 'Route not found', 404));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return bad(res, 'Invalid JSON body');
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`Espada Men API running on http://localhost:${PORT}`));
module.exports = app;
