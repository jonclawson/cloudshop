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
export declare function getDb(db: D1Database): import("drizzle-orm/d1").DrizzleD1Database<typeof schema> & {
    $client: D1Database;
};
export { schema };
