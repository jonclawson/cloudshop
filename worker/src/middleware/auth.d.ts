import { Context } from 'hono';
import { CloudshopEnv } from '../index';
export interface AuthPayload {
    user_id: string;
    email: string;
    iat: number;
    exp: number;
}
export declare function getJwtSecret(c: Context<CloudshopEnv>): string;
export declare function authMiddleware(c: Context<CloudshopEnv>, next: any): Promise<void>;
export declare function optionalAuth(c: Context<CloudshopEnv>, next: any): any;
