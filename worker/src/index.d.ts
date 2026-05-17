import { Hono } from 'hono';
export interface CloudshopEnv {
    Bindings: {
        DB: D1Database;
        R2: R2Bucket;
        KV: KVNamespace;
        ENVIRONMENT: string;
        USE_MOCKS: string;
        JWT_SECRET?: string;
        STRIPE_SECRET_KEY?: string;
        PRINTFUL_API_KEY?: string;
        MAILCHANNELS_API_KEY?: string;
    };
}
declare const app: Hono<CloudshopEnv, import("hono/types").BlankSchema, "/">;
export default app;
