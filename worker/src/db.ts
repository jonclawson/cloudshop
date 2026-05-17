import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export interface CloudshopContext {
  DB: D1Database;
  env: {
    ENVIRONMENT: string;
    USE_MOCKS: string;
    JWT_SECRET?: string;
    STRIPE_SECRET_KEY?: string;
    PRINTFUL_API_KEY?: string;
    MAILCHANNELS_API_KEY?: string;
  };
}

export function getDb(db: D1Database) {
  return drizzle(db, { schema });
}

export { schema };
