import { SignJWT, jwtVerify } from 'jose';

export type AuthPayload = {
  userId: string;
  type: 'access' | 'refresh';
};

export async function hashPassword(password: string): Promise<string> {
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

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
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
  } catch {
    return false;
  }
}

export function generateRandomPassword(length = 24): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  // base64 -> base64url-ish (no padding); ensures printable characters
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return base64.length >= length ? base64.slice(0, length) : base64;
}

export async function generateJWT(userId: string, secret: string): Promise<string> {
  const jwtSecret = new TextEncoder().encode(secret);
  const token = await new SignJWT({ userId, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(jwtSecret);
  return token;
}

export async function generateRefreshToken(userId: string, secret: string): Promise<string> {
  const jwtSecret = new TextEncoder().encode(secret);
  const token = await new SignJWT({ userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(jwtSecret);
  return token;
}

export async function verifyRefreshToken(
  refreshToken: string,
  secret: string
): Promise<AuthPayload> {
  const jwtSecret = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(refreshToken, jwtSecret);

  return {
    userId: payload.userId as string,
    type: payload.type as 'access' | 'refresh',
  };
}
