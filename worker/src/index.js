import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import productsRoutes from './routes/products';
import ordersRoutes from './routes/orders';
import uploadsRoutes from './routes/uploads';
import adminRoutes from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
const app = new Hono();
// Global Middleware
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use('*', errorHandler);
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
//# sourceMappingURL=index.js.map