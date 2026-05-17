import { Context } from 'hono';
import { CloudshopEnv } from '../index';
export declare function errorHandler(c: Context<CloudshopEnv>, next: any): Promise<(Response & import("hono").TypedResponse<{
    error: any;
    status: any;
    timestamp: string;
}, any, "json">) | undefined>;
export declare class ApiError extends Error {
    message: string;
    status: number;
    code?: string | undefined;
    constructor(message: string, status?: number, code?: string | undefined);
}
