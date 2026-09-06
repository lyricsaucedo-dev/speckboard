import './env.js';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './auth.js';
import { apiRouter, finalizeCheckout, stripe } from './api.js';
import { db } from './db.js';
import { ensureDefaultSpeck } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();

// Required behind Railway/Render/Fly so secure cookies see HTTPS
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!stripe || !webhookSecret || webhookSecret.includes('...')) {
      return res.status(400).send('Webhook not configured');
    }

    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      return res.status(400).send('Missing signature');
    }

    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      if (event.type === 'checkout.session.completed') {
        const sessionObj = event.data.object as {
          id: string;
          metadata?: { checkoutId?: string };
        };
        const checkoutId = sessionObj.metadata?.checkoutId;
        if (checkoutId) {
          finalizeCheckout(checkoutId, sessionObj.id);
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error('Webhook error', err);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }
  }
);

app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'speckboard-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'speckboard', store: db.path });
});

app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

app.post('/api/checkout/confirm', async (req, res) => {
  const checkoutId = String(req.body.checkoutId || '');
  const sessionId = String(req.body.sessionId || '');
  if (!checkoutId) return res.status(400).json({ error: 'checkoutId required' });

  if (sessionId.startsWith('demo_')) {
    const ok = finalizeCheckout(checkoutId, sessionId);
    return res.json({ ok });
  }

  if (stripe && sessionId) {
    try {
      const sessionObj = await stripe.checkout.sessions.retrieve(sessionId);
      if (
        sessionObj.payment_status === 'paid' &&
        sessionObj.metadata?.checkoutId === checkoutId
      ) {
        const ok = finalizeCheckout(checkoutId, sessionObj.id);
        return res.json({ ok });
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Confirm failed' });
    }
  }

  const row = db.read().pending_checkouts.find((c) => c.id === checkoutId);
  res.json({ ok: row?.status === 'completed' });
});

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const seedResult = ensureDefaultSpeck();
if (seedResult.seeded) {
  console.log(`Board seed: ${seedResult.message}`);
}

app.listen(PORT, () => {
  console.log(`Speckboard API on http://localhost:${PORT}`);
  console.log(`CORS origin: ${CLIENT_URL}`);
  console.log(`Data store: ${db.path}`);
  if (!stripe) {
    console.log(
      'Stripe keys not set — DEMO_CHECKOUT mode (purchases persist locally without payment)'
    );
  }
});
