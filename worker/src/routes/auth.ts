import { Hono } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { getDb } from '../db';
import { users, refreshTokens, passwordResetTokens } from '../schema';
import { eq, gt, isNull } from 'drizzle-orm';
import { getMailchannelsService } from '../services/mock';

const auth = new Hono<{ Bindings: CloudshopBindings }>();


type CloudshopBindings = {
  DB: D1Database;
  JWT_SECRET?: string;
  ENVIRONMENT?: string;
  USE_MOCKS?: string;
};

// Hash password using PBKDF2 (random salt; used for password hashing/verification)
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

// Deterministic hash for password reset tokens (so we can look up by token_hash)
async function hashResetToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = new Uint8Array(digest);
  // hex encoding is easy to compare and store in TEXT
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

    const environment = c.env.ENVIRONMENT ?? 'development';
    const normalizedEmail = email.trim().toLowerCase();
    const adminEmail = 'admin@example.com';

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    // Non-prod test convenience: ensure admin account exists with known password.
    if (existing.length > 0) {
      if (environment !== 'production' && normalizedEmail === adminEmail) {
        const passwordHash = await hashPassword(password);

        await db
          .update(users)
          .set({ password_hash: passwordHash, admin: true })
          .where(eq(users.id, existing[0].id));

        const userId = existing[0].id;
        const jwtSecret = c.env.JWT_SECRET || 'dev-secret';
        const accessToken = await generateJWT(userId, jwtSecret);
        const refreshToken = await generateRefreshToken(userId, jwtSecret);

        const refreshTokenHash = await hashPassword(refreshToken);
        await db.insert(refreshTokens).values({
          id: crypto.randomUUID(),
          user_id: userId,
          token_hash: refreshTokenHash,
          expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        });

        return c.json(
          {
            user: { id: userId, email: normalizedEmail },
            access_token: accessToken,
            refresh_token: refreshToken,
          },
          201
        );
      }

      return c.json({ error: 'User already exists' }, 400);
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      email: normalizedEmail,
      password_hash: passwordHash,
      admin: environment !== 'production' && normalizedEmail === adminEmail ? true : false,
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // Pragmatic email validation for UX; backend must not trust it.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

auth.post('/forgot-password', async (c) => {
  try {
    const { email } = (await c.req.json()) as { email: string };

    if (!email) {
      return c.json({ error: 'Email required' }, 400);
    }

    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      // Avoid enumeration: still respond success shape.
      return c.json({ message: 'If your email exists, you will receive a reset link' }, 200);
    }

    const db = getDb(c.env.DB);
    const userRow = await db.select().from(users).where(eq(users.email, normalized)).limit(1);

    // Always respond success to prevent account enumeration.
    if (userRow.length === 0) {
      return c.json({ message: 'If your email exists, you will receive a reset link' }, 200);
    }

    const user = userRow[0];
    const resetToken = crypto.randomUUID();
    const resetTokenHash = await hashResetToken(resetToken);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = nowSeconds + 60 * 60; // 1 hour

    await db.insert(passwordResetTokens).values({
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: resetTokenHash,
      expires_at: expiresAt,
      used_at: null,
    });

    const useMocks = c.env.USE_MOCKS === 'true';
    const mailService = await getMailchannelsService(useMocks);
    if (mailService && 'sendPasswordReset' in mailService) {
      await mailService.sendPasswordReset(normalized, resetToken);
    }

    // Dev-only hook: deterministic Playwright testing.
    // Be defensive: in local/e2e we want tokens back, but avoid doing it in production.
    if (c.env.ENVIRONMENT !== 'production') {
      return c.json(
        { message: 'Password reset email queued (dev)', reset_token: resetToken },
        200
      );
    }

    return c.json({ message: 'If your email exists, you will receive a reset link' }, 200);
  } catch (error) {
    console.error('Forgot password error:', error);
    return c.json({ error: 'Forgot password failed' }, 500);
  }
});

auth.post('/reset-password', async (c) => {
  try {
    const { token, new_password } = (await c.req.json()) as {
      token: string;
      new_password: string;
    };

    if (!token || !new_password) {
      return c.json({ error: 'Token and new password required' }, 400);
    }

    if (new_password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const db = getDb(c.env.DB);
    const nowSeconds = Math.floor(Date.now() / 1000);

    const tokenHash = await hashResetToken(token);

    const tokenRow = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token_hash, tokenHash))
      .where(gt(passwordResetTokens.expires_at, nowSeconds))
      .where(isNull(passwordResetTokens.used_at))
      .limit(1);

    if (tokenRow.length === 0) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }

    const resetRow = tokenRow[0];

    const userIdToUpdate = resetRow.user_id;
    const newPasswordHash = await hashPassword(new_password);

    // Confirm the correct user row is being updated.
    const userBefore = await db
      .select({ password_hash: users.password_hash })
      .from(users)
      .where(eq(users.id, userIdToUpdate))
      .limit(1);

    await db
      .update(users)
      .set({ password_hash: newPasswordHash })
      .where(eq(users.id, userIdToUpdate));

    const userAfter = await db
      .select({ password_hash: users.password_hash })
      .from(users)
      .where(eq(users.id, userIdToUpdate))
      .limit(1);

    const updated =
      userAfter.length > 0 && userAfter[0].password_hash === newPasswordHash;

    // Confirm the login verification would succeed with the stored hash.
    const canVerifyNewPassword =
      userAfter.length > 0
        ? await verifyPassword(new_password, userAfter[0].password_hash)
        : false;

    // Log for local debugging (IDs being used + whether update stuck + verify result).
    console.log('🔐 reset-password', {
      token_hash_looked_up_prefix: tokenHash.slice(0, 10),
      reset_token_row_id: resetRow.id,
      reset_token_user_id: userIdToUpdate,
      updated,
      canVerifyNewPassword,
      before_hash_prefix: userBefore[0]?.password_hash?.slice(0, 10),
      after_hash_prefix: userAfter[0]?.password_hash?.slice(0, 10),
    });

    if (!updated) {
      return c.json({ error: 'Password update did not persist' }, 500);
    }

    await db
      .update(passwordResetTokens)
      .set({ used_at: nowSeconds })
      .where(eq(passwordResetTokens.id, resetRow.id));

    const isNonProd = c.env.ENVIRONMENT !== 'production';
    if (isNonProd) {
      return c.json(
        {
          message: 'Password updated successfully',
          debug: {
            reset_token_row_id: resetRow.id,
            reset_token_user_id: userIdToUpdate,
            canVerifyNewPassword,
            before_hash_prefix: userBefore[0]?.password_hash?.slice(0, 10),
            after_hash_prefix: userAfter[0]?.password_hash?.slice(0, 10),
          },
        },
        200
      );
    }

    return c.json({ message: 'Password updated successfully' }, 200);
  } catch (error) {
    console.error('Reset password error:', error);
    return c.json({ error: 'Reset password failed' }, 500);
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
