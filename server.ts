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

function getCurrentShiftId(): string {
  const now = new Date();
  const hour = now.getHours();
  if (hour < 6) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}

function validateUserId(userId: unknown): string | null {
  if (typeof userId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(userId)) return null;
  return userId;
}

app.get('/api/shift/current', (req, res) => {
  const userId = validateUserId(req.query.userId);
  if (!userId) { res.status(400).json({ error: 'Missing or invalid userId' }); return; }

  const shiftId = getCurrentShiftId();
  const row = db.prepare('SELECT data FROM shifts WHERE user_id = ? AND shift_id = ?').get(userId, shiftId) as { data: string } | undefined;
  if (row) {
    res.json({ shiftId, data: JSON.parse(row.data) });
  } else {
    res.json({ shiftId, data: null });
  }
});

app.put('/api/shift/current', (req, res) => {
  const userId = validateUserId(req.body.userId);
  if (!userId) { res.status(400).json({ error: 'Missing or invalid userId' }); return; }

  const shiftId = getCurrentShiftId();
  const data = JSON.stringify(req.body.data);
  db.prepare(`
    INSERT INTO shifts (user_id, shift_id, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, shift_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
  `).run(userId, shiftId, data);
  res.json({ success: true, shiftId });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Patrol Log backend running on port ${PORT}`);
});
