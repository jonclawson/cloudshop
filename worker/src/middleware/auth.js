import { ApiError } from './errorHandler';
const JWT_SECRET = 'cloudshop-dev-secret-change-in-production';
export function getJwtSecret(c) {
    return c.env.JWT_SECRET || JWT_SECRET;
}
export async function authMiddleware(c, next) {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new ApiError('Missing or invalid Authorization header', 401);
    }
    const token = authHeader.slice(7);
    try {
        // Basic JWT validation (you'll need to implement proper JWT verification)
        const [header, payload, signature] = token.split('.');
        if (!header || !payload || !signature) {
            throw new ApiError('Invalid token format', 401);
        }
        const decoded = JSON.parse(atob(payload));
        // Check if token is expired
        if (decoded.exp < Date.now() / 1000) {
            throw new ApiError('Token expired', 401);
        }
        // Store auth info in context for route handlers
        c.set('auth', decoded);
        await next();
    }
    catch (error) {
        throw new ApiError('Unauthorized', 401);
    }
}
export function optionalAuth(c, next) {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const [header, payload, signature] = token.split('.');
            if (header && payload && signature) {
                const decoded = JSON.parse(atob(payload));
                if (decoded.exp > Date.now() / 1000) {
                    c.set('auth', decoded);
                }
            }
        }
        catch (e) {
            // Ignore auth errors in optional auth
        }
    }
    return next();
}
//# sourceMappingURL=auth.js.map