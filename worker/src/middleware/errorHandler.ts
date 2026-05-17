import { Context } from 'hono';
import { CloudshopEnv } from '../index';

export async function errorHandler(c: Context<CloudshopEnv>, next: any) {
  try {
    await next();
  } catch (error: any) {
    console.error('Error:', error);

    const status = error.status || 500;
    const message = error.message || 'Internal Server Error';

    return c.json(
      {
        error: message,
        status,
        timestamp: new Date().toISOString(),
      },
      status
    );
  }
}

export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
