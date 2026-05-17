import { Hono } from 'hono';

const auth = new Hono();

auth.post('/signup', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }
  return c.json({
    user: { id: 'user-123', email },
    access_token: 'mock-jwt-token',
    refresh_token: 'mock-refresh-token',
  }, 201);
});

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }
  return c.json({
    user: { id: 'user-123', email },
    access_token: 'mock-jwt-token',
    refresh_token: 'mock-refresh-token',
  });
});

auth.post('/refresh', async (c) => {
  const { refresh_token } = await c.req.json();
  if (!refresh_token) {
    return c.json({ error: 'Refresh token required' }, 400);
  }
  return c.json({ access_token: 'new-mock-jwt-token' });
});

auth.post('/logout', (c) => {
  return c.json({ message: 'Logged out successfully' });
});

export default auth;
