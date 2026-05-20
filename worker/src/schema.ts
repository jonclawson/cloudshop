import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey().default('uuid()'),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Refresh tokens table
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey().default('uuid()'),
  user_id: text('user_id').notNull(),
  token_hash: text('token_hash').notNull(),
  expires_at: integer('expires_at').notNull(),
  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey().default('uuid()'),
  user_id: text('user_id').notNull(),
  token_hash: text('token_hash').notNull(),
  expires_at: integer('expires_at').notNull(),
  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
  used_at: integer('used_at'),
});

// Products table
export const products = sqliteTable('products', {
  id: text('id').primaryKey().default('uuid()'),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  description: text('description'),
  base_price: real('base_price').notNull(),
  printful_product_id: text('printful_product_id'),
  printful_sync_at: integer('printful_sync_at'),
  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Product variants (sizes, colors, etc.)
export const productVariants = sqliteTable('product_variants', {
  id: text('id').primaryKey().default('uuid()'),
  product_id: text('product_id').notNull(),
  size: text('size'),
  color: text('color'),
  price_override: real('price_override'),
  printful_variant_id: text('printful_variant_id'),
  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Orders table
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey().default('uuid()'),
  user_id: text('user_id').notNull(),
  stripe_payment_id: text('stripe_payment_id'),
  status: text('status').notNull().default('pending'), // pending, paid, fulfilled, cancelled
  total_price: real('total_price').notNull(),
  printful_order_id: text('printful_order_id'),
  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Order items
export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey().default('uuid()'),
  order_id: text('order_id').notNull(),
  product_variant_id: text('product_variant_id').notNull(),
  quantity: integer('quantity').notNull(),
  price_at_purchase: real('price_at_purchase').notNull(),
  user_upload_id: text('user_upload_id'), // design applied to this item
  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// User uploads (design files)
export const userUploads = sqliteTable('user_uploads', {
  id: text('id').primaryKey().default('uuid()'),
  user_id: text('user_id').notNull(),
  file_key: text('file_key').notNull(), // R2 file path
  file_url: text('file_url').notNull(), // R2 public URL
  file_size: integer('file_size'),
  design_name: text('design_name').notNull(),
  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Cart sessions (for guest users)
export const cartSessions = sqliteTable('cart_sessions', {
  id: text('id').primaryKey().default('uuid()'),
  user_id: text('user_id'),
  session_key: text('session_key').notNull().unique(),
  cart_data: text('cart_data').notNull(), // JSON string
  expires_at: integer('expires_at').notNull(),
  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Product sync log (for tracking Printful syncs)
export const productSyncLog = sqliteTable('product_sync_log', {
  id: text('id').primaryKey().default('uuid()'),
  synced_at: integer('synced_at').default(sql`CURRENT_TIMESTAMP`),
  product_count: integer('product_count'),
  variant_count: integer('variant_count'),
  error_message: text('error_message'),
});
