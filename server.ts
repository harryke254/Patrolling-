import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

const db = new Database(path.join(__dirname, 'patrol.db'));

// Migrate old single-user table to per-user table if needed
const tableInfo = db.prepare("PRAGMA table_info(shifts)").all() as { name: string }[];
const hasUserId = tableInfo.some(col => col.name === 'user_id');
if (tableInfo.length > 0 && !hasUserId) {
  db.exec('DROP TABLE shifts');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS shifts (
    user_id TEXT NOT NULL,
    shift_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, shift_id)
  )
`);

function validateUserId(userId: unknown): string | null {
  if (typeof userId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(userId)) return null;
  return userId;
}

function validateShiftId(shiftId: unknown): string | null {
  if (typeof shiftId !== 'string' || !/^\d{4}-\d{2}-\d{2}-[DN](-\d+)?$/.test(shiftId)) return null;
  return shiftId;
}

// Save a specific shift by ID
app.put('/api/shifts/:shiftId', (req, res) => {
  const userId = validateUserId(req.body.userId);
  const shiftId = validateShiftId(req.params.shiftId);
  if (!userId) { res.status(400).json({ error: 'Missing or invalid userId' }); return; }
  if (!shiftId) { res.status(400).json({ error: 'Invalid shiftId' }); return; }

  const data = JSON.stringify(req.body.data);
  db.prepare(`
    INSERT INTO shifts (user_id, shift_id, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, shift_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
  `).run(userId, shiftId, data);
  res.json({ success: true, shiftId });
});

// Fetch all shifts for a user
app.get('/api/shifts/all', (req, res) => {
  const userId = validateUserId(req.query.userId);
  if (!userId) { res.status(400).json({ error: 'Missing or invalid userId' }); return; }

  const rows = db.prepare('SELECT shift_id, data FROM shifts WHERE user_id = ?').all(userId) as { shift_id: string; data: string }[];
  const shifts = rows.map(r => ({ shiftId: r.shift_id, data: JSON.parse(r.data) }));
  res.json({ shifts });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Patrol Log backend running on port ${PORT}`);
});
