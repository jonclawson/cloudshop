import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import productsRoutes from './routes/products';
import ordersRoutes from './routes/orders';
import uploadsRoutes from './routes/uploads';
import adminRoutes from './routes/admin';
import { initializeSchema } from './db/migrations';
import { getDb, schema } from './db';
import { eq } from 'drizzle-orm';

export type CloudshopEnv = {
  DB: D1Database;
  JWT_SECRET?: string;
  ENVIRONMENT?: string;
  USE_MOCKS?: string;
};

type Bindings = CloudshopEnv;

const app = new Hono<{ Bindings }>();

const SEEDED_ADMIN_EMAIL = 'admin@example.com';

// Initialize schema on first request, then verify seeded admin exists.
// The Playwright admin tests rely on `admin@example.com` / `password123`.
let schemaInitialized = false;
let seededAdminVerified = false;

app.use('*', async (c, next) => {
  const environment = c.env.ENVIRONMENT || 'production';

  if (!schemaInitialized) {
    try {
      await initializeSchema(c.env.DB, environment);
      schemaInitialized = true;
    } catch (error) {
      console.error('Schema initialization error:', error);
      schemaInitialized = true; // continue; schema may already exist
    }
  }

  // In non-prod, ensure seeded admin exists even if code/DB changed after worker startup.
  if (!seededAdminVerified && environment !== 'production') {
    try {
      const db = getDb(c.env.DB);
      const adminRows = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, SEEDED_ADMIN_EMAIL))
        .limit(1);

      if (adminRows.length > 0) {
        seededAdminVerified = true;
      } else {
        // Retry seeding by re-running initializeSchema (it is idempotent for our use case)
        await initializeSchema(c.env.DB, environment);
        seededAdminVerified = true;
      }
    } catch (error) {
      console.error('Seeded admin verification failed (continuing):', error);
      // Don't block requests; next attempt may succeed.
    }
  }

  await next();
});

// Middleware
app.use('*', cors());

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/products', productsRoutes);
app.route('/api/orders', ordersRoutes);
app.route('/api/uploads', uploadsRoutes);
app.route('/api/admin', adminRoutes);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// 404 handler
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

export default app;
