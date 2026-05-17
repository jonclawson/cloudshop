export async function errorHandler(c, next) {
    try {
        await next();
    }
    catch (error) {
        console.error('Error:', error);
        const status = error.status || 500;
        const message = error.message || 'Internal Server Error';
        return c.json({
            error: message,
            status,
            timestamp: new Date().toISOString(),
        }, status);
    }
}
export class ApiError extends Error {
    constructor(message, status = 400, code) {
        super(message);
        this.message = message;
        this.status = status;
        this.code = code;
        this.name = 'ApiError';
    }
}
//# sourceMappingURL=errorHandler.js.map