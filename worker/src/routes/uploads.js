import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
const uploads = new Hono();
// POST /api/uploads - Upload art file to R2
uploads.post('/', authMiddleware, async (c) => {
    try {
        const auth = c.get('auth');
        const formData = await c.req.formData();
        const file = formData.get('file');
        const designName = formData.get('design_name') || 'Untitled Design';
        if (!file) {
            throw new ApiError('File required', 400);
        }
        // TODO: Implement file upload logic
        // - Validate file type (image only)
        // - Validate file size (< 10MB)
        // - Upload to R2
        // - Store metadata in D1
        // - Return upload record with URL
        return c.json({
            id: 'upload-123',
            file_key: `designs/${auth.user_id}/${file.name}`,
            file_url: `https://r2.example.com/designs/${auth.user_id}/${file.name}`,
            design_name: designName,
            file_size: file.size,
            created_at: new Date().toISOString(),
        });
    }
    catch (error) {
        throw error;
    }
});
// GET /api/uploads - List user uploads
uploads.get('/', authMiddleware, async (c) => {
    try {
        const auth = c.get('auth');
        // TODO: Implement uploads list fetch
        // - Query D1 for uploads by user_id
        // - Return paginated results
        return c.json({
            uploads: [],
            total: 0,
            page: 1,
        });
    }
    catch (error) {
        throw error;
    }
});
// DELETE /api/uploads/:id - Delete upload
uploads.delete('/:id', authMiddleware, async (c) => {
    try {
        const auth = c.get('auth');
        const uploadId = c.req.param('id');
        // TODO: Implement upload deletion logic
        // - Verify upload belongs to authenticated user
        // - Delete from R2
        // - Delete from D1
        return c.json({ message: 'Upload deleted' });
    }
    catch (error) {
        throw error;
    }
});
export default uploads;
//# sourceMappingURL=uploads.js.map