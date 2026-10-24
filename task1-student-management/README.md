# Task 1: Student Management System (in-memory, no authorization)

Run: `npm install` then `npm start` (http://localhost:3000). Data is kept in arrays, so it resets when the server restarts.

Every module has the same CRUD routes:

| Method | Route | Action |
|--------|-------|--------|
| POST | /{module} | Create |
| GET | /{module} | Read all (filters like `?studentId=1`) |
| GET | /{module}/:id | Read one |
| PUT | /{module}/:id | Update (all fields) |
| PATCH | /{module}/:id | Update (some fields) |
| DELETE | /{module}/:id | Delete |

`{module}` = `students`, `teachers`, `attendance`, `marks`.

## Fields
- **students**: name, rollNo (unique), email, department, semester (1-8)
- **teachers**: name, email (unique), department, subject
- **attendance**: studentId, subject, date (YYYY-MM-DD), status (present / absent / leave). One record per student + subject + date.
- **marks**: studentId, subject, examType (quiz / assignment / mid / final), obtained, total (obtained must be between 0 and total)

Rules: attendance and marks need an existing studentId; deleting a student also deletes his attendance and marks. Extra route: `GET /students/:id/report` (attendance % and marks %).

## Example
```
POST /students
{ "name": "Ali", "rollNo": "249001", "email": "ali@x.com", "department": "CS", "semester": 4 }

POST /marks
{ "studentId": 1, "subject": "OS", "examType": "mid", "obtained": 24, "total": 30 }
```
