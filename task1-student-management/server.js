const express = require('express');
const makeCrud = require('./crud');
const { db } = require('./store');

const app = express();
app.use(express.json());

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const studentExists = (id) => db.students.some((s) => s.id === Number(id));

// ---------- STUDENT ----------
app.use('/students', makeCrud({
  name: 'students',
  fields: ['name', 'rollNo', 'email', 'department', 'semester'],
  required: ['name', 'rollNo', 'email', 'department', 'semester'],
  validate: (d, current) => {
    if (!isEmail(d.email)) return 'Invalid email';
    if (!Number.isInteger(d.semester) || d.semester < 1 || d.semester > 8) return 'semester must be a whole number from 1 to 8';
    const dup = db.students.find((s) => s.rollNo === d.rollNo && s !== current);
    if (dup) return `rollNo ${d.rollNo} already exists`;
    return null;
  },
  // deleting a student also removes his attendance and marks
  onDelete: (s) => {
    db.attendance = db.attendance.filter((a) => a.studentId !== s.id);
    db.marks = db.marks.filter((m) => m.studentId !== s.id);
  },
}));

// ---------- TEACHER ----------
app.use('/teachers', makeCrud({
  name: 'teachers',
  fields: ['name', 'email', 'department', 'subject'],
  required: ['name', 'email', 'department', 'subject'],
  validate: (d, current) => {
    if (!isEmail(d.email)) return 'Invalid email';
    const dup = db.teachers.find((t) => t.email === d.email && t !== current);
    if (dup) return `email ${d.email} already used by another teacher`;
    return null;
  },
}));

// ---------- ATTENDANCE ----------
const STATUS = ['present', 'absent', 'leave'];
app.use('/attendance', makeCrud({
  name: 'attendance',
  fields: ['studentId', 'subject', 'date', 'status'],
  required: ['studentId', 'subject', 'date', 'status'],
  validate: (d, current) => {
    if (!studentExists(d.studentId)) return `Student ${d.studentId} does not exist`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || isNaN(Date.parse(d.date))) return 'date must look like YYYY-MM-DD';
    if (!STATUS.includes(d.status)) return `status must be one of: ${STATUS.join(', ')}`;
    const dup = db.attendance.find((a) => a.studentId === d.studentId && a.subject === d.subject && a.date === d.date && a !== current);
    if (dup) return 'Attendance for this student, subject and date is already marked';
    return null;
  },
}));

// ---------- MARKS ----------
const EXAMS = ['quiz', 'assignment', 'mid', 'final'];
app.use('/marks', makeCrud({
  name: 'marks',
  fields: ['studentId', 'subject', 'examType', 'obtained', 'total'],
  required: ['studentId', 'subject', 'examType', 'obtained', 'total'],
  validate: (d) => {
    if (!studentExists(d.studentId)) return `Student ${d.studentId} does not exist`;
    if (!EXAMS.includes(d.examType)) return `examType must be one of: ${EXAMS.join(', ')}`;
    if (typeof d.obtained !== 'number' || typeof d.total !== 'number') return 'obtained and total must be numbers';
    if (d.total <= 0) return 'total must be greater than 0';
    if (d.obtained < 0 || d.obtained > d.total) return 'obtained must be between 0 and total';
    return null;
  },
}));

// ---------- extra: report of one student (not required, but handy) ----------
app.get('/students/:id/report', (req, res) => {
  const id = Number(req.params.id);
  const student = db.students.find((s) => s.id === id);
  if (!student) return res.status(404).json({ error: 'students record not found' });
  const att = db.attendance.filter((a) => a.studentId === id);
  const present = att.filter((a) => a.status === 'present').length;
  const marks = db.marks.filter((m) => m.studentId === id);
  const obtained = marks.reduce((s, m) => s + m.obtained, 0);
  const total = marks.reduce((s, m) => s + m.total, 0);
  res.json({
    student,
    attendance: { classes: att.length, present, percentage: att.length ? +((present / att.length) * 100).toFixed(1) : null },
    marks: { records: marks.length, obtained, total, percentage: total ? +((obtained / total) * 100).toFixed(1) : null },
  });
});

app.get('/', (req, res) => res.json({ message: 'Student Management System API', modules: ['/students', '/teachers', '/attendance', '/marks'] }));

// unknown route + bad JSON
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.type === 'entity.parse.failed' ? 'Invalid JSON body' : err.message }));

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`Student Management API running on http://localhost:${PORT}`));
module.exports = app;
