import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey().default('uuid()'),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  // SQLite doesn't have a real boolean type; Drizzle maps this to INTEGER (0/1)
  admin: integer('admin', { mode: 'boolean' }).notNull().default(false),
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

  // External provider info (e.g. Printful)
  provider: text('provider').notNull(),
  provider_product_id: text('provider_product_id').notNull(),
  provider_sync_at: integer('provider_sync_at'),

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

  provider_variant_id: text('provider_variant_id').notNull(),

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
  provider: text('provider'),
  product_variant_id: text('product_variant_id').notNull(),
  quantity: integer('quantity').notNull(),
  price_at_purchase: real('price_at_purchase').notNull(),
  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const orderItemUploads = sqliteTable(
  'order_item_uploads',
  {
    id: text('id').primaryKey().default('uuid()'),
    order_item_id: text('order_item_id').notNull(),
    user_upload_id: text('user_upload_id').notNull(),
    created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => {
    return [
      index('order_item_uploads_order_item_id_index').on(table.order_item_id),
      index('order_item_uploads_user_upload_id_index').on(table.user_upload_id),
      uniqueIndex('order_item_uploads_order_item_id_user_upload_id_unique').on(
        table.order_item_id,
        table.user_upload_id
      ),
    ];
  }
);

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

export const files = sqliteTable('files', {
  id: text('id').primaryKey().default('uuid()'), // hashed id from url/parent
  parent: text('parent').notNull(), // 'product' | 'variant' | 'order'
  parent_id: text('parent_id').notNull(),

  url: text('url').notNull(),
  filename: text('filename').notNull(),
  meta: text('meta'),

  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return [
    // Standard composite index
    index('files_parent_parent_id_index').on(table.parent, table.parent_id),
    
    // Unique composite index
    uniqueIndex('files_parent_parent_id_url_unique').on(table.parent, table.parent_id, table.url),
  ];
});

// Normalized addresses, deduplicated per user
export const addresses = sqliteTable('addresses', {
  id: text('id').primaryKey().default('uuid()'),
  user_id: text('user_id').notNull(),

  name: text('name'),
  line1: text('line1'),
  line2: text('line2'),
  city: text('city'),
  state: text('state'),
  postal_code: text('postal_code'),
  country: text('country'),

  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return [
    index('addresses_user_id_index').on(table.user_id),
  ];
});

// Junction table linking orders to addresses (billing or shipping)
export const orderAddresses = sqliteTable('order_addresses', {
  id: text('id').primaryKey().default('uuid()'),
  order_id: text('order_id').notNull(),
  address_id: text('address_id').notNull(),
  address_type: text('address_type').notNull(), // 'billing' | 'shipping'

  created_at: integer('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return [
    index('order_addresses_order_id_index').on(table.order_id),
    index('order_addresses_address_id_index').on(table.address_id),
  ];
});
