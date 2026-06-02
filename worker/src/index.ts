import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import productsRoutes from './routes/products';
import ordersRoutes from './routes/orders';
import uploadsRoutes from './routes/uploads';
import imageProxyRoutes from './routes/imageProxy';
import adminRoutes from './routes/admin';
import categoriesRoutes from './routes/categories';
import { getDb, schema } from './db';
import { eq } from 'drizzle-orm';
import { hashPassword } from './services/authUtils';

export type CloudshopEnv = {
  DB: D1Database;
  JWT_SECRET?: string;
  ENVIRONMENT?: string;
  USE_MOCKS?: string;
};

type Bindings = CloudshopEnv;

const app = new Hono<{ Bindings }>();

const SEEDED_ADMIN_EMAIL = 'admin@example.com';
const SEEDED_ADMIN_PASSWORD = 'password123';

// In non-prod, ensure seeded admin exists even if code/DB changed after worker startup.
let seededAdminVerified = false;

app.use('*', async (c, next) => {
  const environment = c.env.ENVIRONMENT || 'production';

  if (!seededAdminVerified && environment !== 'production') {
    try {
      const db = getDb(c.env.DB);
      const adminRows = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, SEEDED_ADMIN_EMAIL))
        .limit(1);

      if (adminRows.length === 0) {
        const userId = crypto.randomUUID();
        const passwordHash = await hashPassword(SEEDED_ADMIN_PASSWORD);

        await db.insert(schema.users).values({
          id: userId,
          email: SEEDED_ADMIN_EMAIL,
          password_hash: passwordHash,
          admin: true,
        });
      }

      seededAdminVerified = true;
    } catch (error) {
      // Don't block requests; migrations should already be applied before the worker starts.
      console.error('Seeded admin verification failed (continuing):', error);
    }
  }

  await next();
});

// Middleware
app.use('*', cors());

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/products', productsRoutes);
app.route('/api/categories', categoriesRoutes);
app.route('/api/orders', ordersRoutes);
app.route('/api/uploads', uploadsRoutes);
app.route('/api/image-proxy', imageProxyRoutes);
app.route('/api/admin', adminRoutes);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// 404 handler
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

export default app;
