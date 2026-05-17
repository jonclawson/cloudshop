import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
export function getDb(db) {
    return drizzle(db, { schema });
}
export { schema };
//# sourceMappingURL=db.js.map