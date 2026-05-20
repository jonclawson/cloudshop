import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { hashPassword } from '../services/authUtils';

export async function initializeSchema(db: D1Database, environment: string): Promise<void> {
  try {
    // Create users table (base columns)
    await db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `
      )
      .run();

    // Add users.admin column for existing DBs.
    // SQLite doesn't support MODIFY COLUMN; we use ADD COLUMN + ignore if it already exists.
    try {
      await db
        .prepare(`
          ALTER TABLE users ADD COLUMN admin INTEGER NOT NULL DEFAULT 0
        `)
        .run();
    } catch (err) {
      // If column already exists, ALTER TABLE will throw. That's fine.
      // Re-throw only on unexpected errors.
      const message = err instanceof Error ? err.message : '';
      if (!message.toLowerCase().includes('duplicate') && !message.toLowerCase().includes('exists')) {
        throw err;
      }
    }

    // Create refresh_tokens table
    await db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `
      )
      .run();

    // Create products table
    await db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        description TEXT,
        base_price REAL NOT NULL,
        printful_product_id TEXT,
        printful_sync_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `
      )
      .run();

    // Create product_variants table
    await db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        size TEXT,
        color TEXT,
        price_override REAL,
        printful_variant_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(product_id) REFERENCES products(id)
      )
    `
      )
      .run();

    // Create orders table
    await db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        stripe_payment_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        total_price REAL NOT NULL,
        printful_order_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `
      )
      .run();

    // Create order_items table
    await db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_variant_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price_at_purchase REAL NOT NULL,
        user_upload_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(product_variant_id) REFERENCES product_variants(id)
      )
    `
      )
      .run();

    // Create user_uploads table
    await db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS user_uploads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        file_key TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_size INTEGER,
        design_name TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `
      )
      .run();

    // Create password_reset_tokens table
    await db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `
      )
      .run();

    // Create cart_sessions table
    await db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS cart_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        session_key TEXT NOT NULL UNIQUE,
        cart_data TEXT NOT NULL, // JSON string
        expires_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `
      )
      .run();

    // Create product_sync_log table
    await db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS product_sync_log (
        id TEXT PRIMARY KEY,
        synced_at INTEGER DEFAULT (strftime('%s', 'now')),
        product_count INTEGER,
        variant_count INTEGER,
        error_message TEXT
      )
    `
      )
      .run();

    // Seed testing admin user (so Playwright can authenticate admin routes)
    // Only seed in non-production.
    if (environment !== 'production') {
      try {
        const adminEmail = 'admin@example.com';
        const adminPassword = 'password123';

        const ormDb = getDb(db);
        const existing = await ormDb
          .select({ id: schema.users.id, admin: schema.users.admin })
          .from(schema.users)
          .where(eq(schema.users.email, adminEmail))
          .limit(1);

        if (existing.length === 0) {
          const userId = crypto.randomUUID();
          const passwordHash = await hashPassword(adminPassword);

          await ormDb.insert(schema.users).values({
            id: userId,
            email: adminEmail,
            password_hash: passwordHash,
            admin: true,
          });
        } else if (!existing[0].admin) {
          await ormDb
            .update(schema.users)
            .set({ admin: true })
            .where(eq(schema.users.id, existing[0].id));
        }
      } catch (seedError) {
        // Don't fail the whole schema init if seeding fails; otherwise we can leave
        // the DB half-initialized and break auth flows.
        console.error('Admin seed failed (continuing):', seedError);
      }
    }

    console.log('✓ Database schema initialized successfully');
  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    throw error;
  }
}
