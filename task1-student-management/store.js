// In-memory data store (data is lost when the server restarts).
const db = {
  students: [],
  teachers: [],
  attendance: [],
  marks: [],
};

// separate id counter for every collection
const nextId = { students: 1, teachers: 1, attendance: 1, marks: 1 };

module.exports = { db, nextId };
