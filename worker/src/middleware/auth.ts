import { Context } from 'hono';
import { CloudshopEnv } from '../index';
import { ApiError } from './errorHandler';

export interface AuthPayload {
  user_id: string;
  email: string;
  iat: number;
  exp: number;
}

const JWT_SECRET = 'cloudshop-dev-secret-change-in-production';

export function getJwtSecret(c: Context<CloudshopEnv>): string {
  return c.env.JWT_SECRET || JWT_SECRET;
}

export async function authMiddleware(c: Context<CloudshopEnv>, next: any) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.slice(7);

  try {
    // Basic JWT validation (you'll need to implement proper JWT verification)
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) {
      throw new ApiError('Invalid token format', 401);
    }

    const decoded = JSON.parse(atob(payload)) as AuthPayload;

    // Check if token is expired
    if (decoded.exp < Date.now() / 1000) {
      throw new ApiError('Token expired', 401);
    }

    // Store auth info in context for route handlers
    c.set('auth', decoded);
    await next();
  } catch (error: any) {
    throw new ApiError('Unauthorized', 401);
  }
}

export function optionalAuth(c: Context<CloudshopEnv>, next: any) {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const [header, payload, signature] = token.split('.');
      if (header && payload && signature) {
        const decoded = JSON.parse(atob(payload)) as AuthPayload;
        if (decoded.exp > Date.now() / 1000) {
          c.set('auth', decoded);
        }
      }
    } catch (e) {
      // Ignore auth errors in optional auth
    }
  }

  return next();
}
