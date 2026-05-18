import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import productsRoutes from './routes/products';
import ordersRoutes from './routes/orders';
import uploadsRoutes from './routes/uploads';
import adminRoutes from './routes/admin';
import { initializeSchema } from './db/migrations';

type Bindings = {
  DB: D1Database;
  JWT_SECRET?: string;
  ENVIRONMENT?: string;
  USE_MOCKS?: string;
};

const app = new Hono<{ Bindings }>();

// Initialize schema on first request
let schemaInitialized = false;
app.use('*', async (c, next) => {
  if (!schemaInitialized) {
    try {
      await initializeSchema(c.env.DB);
      schemaInitialized = true;
    } catch (error) {
      console.error('Schema initialization error:', error);
      // Continue anyway - schema may already exist
      schemaInitialized = true;
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
