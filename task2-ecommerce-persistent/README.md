# Task 2: Espada Men Store API (persistent, SQLite)

Backend for the Lab 3 "Espada Men" website. On first run the database is filled with the 3 products from that page (Classic Formal Suit Rs. 24,999, Premium Dress Shirt Rs. 4,999, Luxury Leather Jacket Rs. 14,999) in the categories Suits, Shirts and Jackets, with their image links. The "Buy Now" buttons map to the cart and order endpoints.

Run: `npm install` then `npm start` (http://localhost:3000). Data is saved in `ecommerce.db` (created automatically), so it stays after restart.

## Endpoints
**Categories**: POST /categories, GET /categories, GET /categories/:id, PUT /categories/:id, DELETE /categories/:id

**Products** (fields: name, description, price, stock, imageUrl, categoryId): POST /products, GET /products, GET /products/:id, PUT /products/:id, PATCH /products/:id, DELETE /products/:id
- GET /products filters: `search`, `categoryId`, `minPrice`, `maxPrice`, `inStock=true`, `sort` (price_asc, price_desc, name, newest), `page`, `limit`

**Customers**: POST /customers, GET /customers, GET /customers/:id, PUT /customers/:id, DELETE /customers/:id

**Cart** (per customer):
- GET /customers/:id/cart
- POST /customers/:id/cart  `{ "productId": 1, "quantity": 2 }`
- PUT /customers/:id/cart/:productId  `{ "quantity": 3 }`
- DELETE /customers/:id/cart/:productId
- DELETE /customers/:id/cart

**Orders**:
- POST /orders  `{ "customerId": 1 }` (checkout of the cart: checks stock, reduces stock, empties cart, all in one transaction)
- GET /orders (`?customerId=` `?status=`), GET /orders/:id
- PATCH /orders/:id/status  `{ "status": "paid" }` (pending -> paid -> shipped -> delivered; cancel allowed from pending/paid)
- DELETE /orders/:id (cancels the order and puts the stock back)

## Order of use
1. GET /products (the 3 Espada Men products are already there), POST /customers
2. POST /customers/1/cart  `{ "productId": 1, "quantity": 1 }`
3. POST /orders  `{ "customerId": 1 }`

To reset the data, stop the server and delete `ecommerce.db`.
