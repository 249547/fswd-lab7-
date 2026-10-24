// Persistent storage: SQLite file. Data stays after the server restarts.
const Database = require('better-sqlite3');
const path = require('path');

const file = process.env.DB_FILE || path.join(__dirname, 'ecommerce.db');
const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  price       REAL NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url   TEXT DEFAULT '',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  email   TEXT NOT NULL UNIQUE,
  address TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cart_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  total       REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,      -- copied at purchase time
  price      REAL NOT NULL,      -- copied at purchase time
  quantity   INTEGER NOT NULL
);
`);

// First run only: add the 3 products from the Lab 3 "Espada Men" page
if (db.prepare('SELECT COUNT(*) n FROM products').get().n === 0 && db.prepare('SELECT COUNT(*) n FROM categories').get().n === 0) {
  const addCat = db.prepare('INSERT INTO categories (name) VALUES (?)');
  const addProd = db.prepare('INSERT INTO products (name, description, price, stock, image_url, category_id) VALUES (?,?,?,?,?,?)');
  db.transaction(() => {
    const suits = addCat.run('Suits').lastInsertRowid;
    const shirts = addCat.run('Shirts').lastInsertRowid;
    const jackets = addCat.run('Jackets').lastInsertRowid;
    addProd.run('Classic Formal Suit', 'Elegant and comfortable formal wear for special occasions.', 24999, 10,
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&q=80', suits);
    addProd.run('Premium Dress Shirt', 'Stylish premium shirt designed for a smart and classy look.', 4999, 25,
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500&q=80', shirts);
    addProd.run('Luxury Leather Jacket', 'Premium leather jacket made for a bold and modern style.', 14999, 8,
      'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=500&q=80', jackets);
  })();
}

module.exports = db;
