# Lab Task 7

Name: Muhammad Raziullah | Roll No: 249547

| Task | Folder | Storage |
|------|--------|---------|
| 1. Student Management System (Student, Teacher, Attendance, Marks CRUD, no authorization) | `task1-student-management` | In-memory (Node.js + Express) |
| 2. E-commerce store endpoints (Lab 3) using persistent APIs | `task2-ecommerce-persistent` | SQLite file (Express + better-sqlite3) |

## How to run (each folder)
```
npm install
npm start        # server on http://localhost:3000
npm test         # runs the self-test
```
Use PORT=4000 npm start to change the port. Test with Postman / Thunder Client / curl. Send JSON bodies with `Content-Type: application/json`.

Note: the "in memory api" file from the lab was not available to me, so Task 1 is a complete Express in-memory API written in the same style (arrays in memory, lost on restart). Task 2 is based on the Lab 3 "Espada Men" page: its 3 products are seeded, and categories, customers, cart and orders are added around them.
