import { MiddlewareHandler } from 'hono';
import { jwtVerify } from 'jose';

export interface AuthPayload {
  userId: string;
  type: 'access' | 'refresh';
}

export const verifyJWT: MiddlewareHandler<{ Variables: { auth: AuthPayload } }> = async (
  c,
  next
) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const jwtSecret = (c.env as any).JWT_SECRET || 'dev-secret';
  const secret = new TextEncoder().encode(jwtSecret);

  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;
    const type = payload.type as 'access' | 'refresh';

    if (!userId || type !== 'access') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    c.set('auth', { userId, type });
    await next();
  } catch (error) {
    // Avoid noisy stack traces for expected auth failures (the client will handle 401 + refresh).
    // console.warn('JWT verification failed:', error);

    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};

export const optionalAuth: MiddlewareHandler<{ Variables: { auth?: AuthPayload } }> = async (
  c,
  next
) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const jwtSecret = (c.env as any).JWT_SECRET || 'dev-secret';
    const secret = new TextEncoder().encode(jwtSecret);

    try {
      const { payload } = await jwtVerify(token, secret);
      const userId = payload.userId as string;
      const type = payload.type as 'access' | 'refresh';

      if (userId && type === 'access') {
        c.set('auth', { userId, type });
      }
    } catch (e) {
      // Ignore auth errors in optional auth
    }
  }

  await next();
};
