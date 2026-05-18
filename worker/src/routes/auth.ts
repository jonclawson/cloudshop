import { Hono } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { getDb } from '../db';
import { users, refreshTokens } from '../schema';
import { eq } from 'drizzle-orm';

const auth = new Hono<{ Bindings: CloudshopBindings }>();

type CloudshopBindings = {
  DB: D1Database;
  JWT_SECRET?: string;
  ENVIRONMENT?: string;
};

// Hash password using PBKDF2
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', data, 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  const hash = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + hash.length);
  combined.set(salt);
  combined.set(hash, salt.length);
  return btoa(String.fromCharCode(...combined));
}

// Verify password
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const combined = Uint8Array.from(atob(hashedPassword), (c) => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);
    const key = await crypto.subtle.importKey('raw', data, 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      key,
      256
    );
    const computedHash = new Uint8Array(derivedBits);
    return computedHash.every((byte, index) => byte === storedHash[index]);
  } catch (e) {
    return false;
  }
}

// Generate JWT
async function generateJWT(userId: string, secret: string): Promise<string> {
  const jwtSecret = new TextEncoder().encode(secret);
  const token = await new SignJWT({ userId, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(jwtSecret);
  return token;
}

// Generate refresh token
async function generateRefreshToken(userId: string, secret: string): Promise<string> {
  const jwtSecret = new TextEncoder().encode(secret);
  const token = await new SignJWT({ userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(jwtSecret);
  return token;
}

// POST /signup
auth.post('/signup', async (c) => {
  try {
    const { email, password } = (await c.req.json()) as { email: string; password: string };

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const db = getDb(c.env.DB);
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: 'User already exists' }, 400);
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      email,
      password_hash: passwordHash,
    });

    const jwtSecret = c.env.JWT_SECRET || 'dev-secret';
    const accessToken = await generateJWT(userId, jwtSecret);
    const refreshToken = await generateRefreshToken(userId, jwtSecret);

    // Store refresh token hash
    const refreshTokenHash = await hashPassword(refreshToken);
    await db.insert(refreshTokens).values({
      id: crypto.randomUUID(),
      user_id: userId,
      token_hash: refreshTokenHash,
      expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    });

    return c.json(
      {
        user: { id: userId, email },
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      201
    );
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Signup failed' }, 500);
  }
});

// POST /login
auth.post('/login', async (c) => {
  try {
    const { email, password } = (await c.req.json()) as { email: string; password: string };

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }

    const db = getDb(c.env.DB);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const isValidPassword = await verifyPassword(password, user[0].password_hash);
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const jwtSecret = c.env.JWT_SECRET || 'dev-secret';
    const accessToken = await generateJWT(user[0].id, jwtSecret);
    const refreshToken = await generateRefreshToken(user[0].id, jwtSecret);

    // Store refresh token hash
    const refreshTokenHash = await hashPassword(refreshToken);
    await db.insert(refreshTokens).values({
      id: crypto.randomUUID(),
      user_id: user[0].id,
      token_hash: refreshTokenHash,
      expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    });

    return c.json({
      user: { id: user[0].id, email: user[0].email },
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// POST /refresh
auth.post('/refresh', async (c) => {
  try {
    const { refresh_token } = (await c.req.json()) as { refresh_token: string };

    if (!refresh_token) {
      return c.json({ error: 'Refresh token required' }, 400);
    }

    const jwtSecret = c.env.JWT_SECRET || 'dev-secret';
    const secret = new TextEncoder().encode(jwtSecret);

    const { payload } = await jwtVerify(refresh_token, secret);
    const userId = payload.userId as string;

    if (!userId) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    const db = getDb(c.env.DB);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    const newAccessToken = await generateJWT(userId, jwtSecret);
    return c.json({ access_token: newAccessToken });
  } catch (error) {
    console.error('Refresh error:', error);
    return c.json({ error: 'Invalid refresh token' }, 401);
  }
});

// POST /logout
auth.post('/logout', async (c) => {
  try {
    const { refresh_token } = (await c.req.json()) as { refresh_token: string };

    if (!refresh_token) {
      return c.json({ error: 'Refresh token required' }, 400);
    }

    const jwtSecret = c.env.JWT_SECRET || 'dev-secret';
    const secret = new TextEncoder().encode(jwtSecret);

    const { payload } = await jwtVerify(refresh_token, secret);
    const userId = payload.userId as string;

    if (userId) {
      const db = getDb(c.env.DB);
      await db.delete(refreshTokens).where(eq(refreshTokens.user_id, userId));
    }

    return c.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ message: 'Logged out successfully' });
  }
});

export default auth;
