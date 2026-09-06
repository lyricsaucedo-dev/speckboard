import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { db, nowIso } from './db.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

export type UserPublic = {
  id: string;
  email: string;
  displayName: string | null;
};

function toPublic(row: { id: string; email: string; display_name: string | null }): UserPublic {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  const password = String(req.body.password || '');
  const displayName = String(req.body.displayName || '').trim() || null;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const store = db.read();
  if (store.users.some((u) => u.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 10);
  db.update((s) => {
    s.users.push({
      id,
      email,
      password_hash: passwordHash,
      display_name: displayName,
      created_at: nowIso(),
    });
  });

  req.session.userId = id;
  return res.json({ user: toPublic({ id, email, display_name: displayName }) });
});

authRouter.post('/login', async (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  const password = String(req.body.password || '');

  const row = db.read().users.find((u) => u.email.toLowerCase() === email);
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  req.session.userId = row.id;
  return res.json({
    user: toPublic({ id: row.id, email: row.email, display_name: row.display_name }),
  });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

authRouter.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }
  const row = db.read().users.find((u) => u.id === req.session.userId);
  if (!row) {
    req.session.userId = undefined;
    return res.json({ user: null });
  }
  return res.json({
    user: toPublic({ id: row.id, email: row.email, display_name: row.display_name }),
  });
});

export function requireAuth(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  next();
}
