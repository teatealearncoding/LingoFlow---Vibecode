
import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('lingoflow.db');
const JWT_SECRET = process.env.JWT_SECRET || 'lingoflow-secret-key-123';

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    userId TEXT,
    word TEXT,
    pronunciation TEXT,
    vietnameseMeaning TEXT,
    context TEXT,
    difficulty TEXT,
    source TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    due INTEGER,
    stability REAL,
    difficultyRating REAL,
    elapsedDays INTEGER,
    scheduledDays INTEGER,
    reps INTEGER,
    state INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- Auth Routes ---

  app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
      const id = Math.random().toString(36).substr(2, 9);
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const stmt = db.prepare('INSERT INTO users (id, email, password) VALUES (?, ?, ?)');
      stmt.run(id, email, hashedPassword);
      
      const token = jwt.sign({ id, email }, JWT_SECRET);
      res.json({ token, user: { id, email } });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
      res.json({ token, user: { id: user.id, email: user.email } });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // --- Middleware to verify JWT ---
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // --- Flashcard Routes ---

  app.get('/api/cards', authenticate, (req: any, res) => {
    const cards = db.prepare('SELECT * FROM flashcards WHERE userId = ?').all(req.user.id);
    res.json(cards);
  });

  app.post('/api/cards/sync', authenticate, (req: any, res) => {
    const { cards } = req.body; // Array of cards to sync
    if (!Array.isArray(cards)) return res.status(400).json({ error: 'Invalid data' });

    const insert = db.prepare(`
      INSERT OR REPLACE INTO flashcards (
        id, userId, word, pronunciation, vietnameseMeaning, context, difficulty, source, 
        createdAt, updatedAt, due, stability, difficultyRating, elapsedDays, 
        scheduledDays, reps, state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((cardsToSync) => {
      for (const card of cardsToSync) {
        insert.run(
          card.id, req.user.id, card.word, card.pronunciation, card.vietnameseMeaning, 
          card.context, card.difficulty, card.source, card.createdAt, card.updatedAt, 
          card.due, card.stability, card.difficultyRating, card.elapsedDays, 
          card.scheduledDays, card.reps, card.state
        );
      }
    });

    transaction(cards);
    res.json({ status: 'ok' });
  });

  app.delete('/api/cards/:id', authenticate, (req: any, res) => {
    db.prepare('DELETE FROM flashcards WHERE id = ? AND userId = ?').run(req.params.id, req.user.id);
    res.json({ status: 'ok' });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
