import { Hono } from 'hono';

const uploads = new Hono();

type FileLike = { name: string; size: number };

function isFileLike(value: unknown): value is FileLike {
  if (typeof value === 'string' || value === null) return false;
  if (typeof value !== 'object') return false;

  const v = value as { name?: unknown; size?: unknown };
  return typeof v.name === 'string' && typeof v.size === 'number';
}

uploads.post('/', async (c) => {
  const formData = await c.req.formData();
  const fileEntry = formData.get('file');
  const designName = (formData.get('design_name') as string) || 'Untitled';

  if (!isFileLike(fileEntry)) {
    return c.json({ error: 'File required' }, 400);
  }

  return c.json({
    id: 'upload-123',
    file_key: `designs/user/${fileEntry.name}`,
    file_url: `https://r2.example.com/designs/user/${fileEntry.name}`,
    design_name: designName,
    file_size: fileEntry.size,
    created_at: new Date().toISOString(),
  }, 201);
});

uploads.get('/', (c) => {
  return c.json({ uploads: [], total: 0, page: 1 });
});

uploads.delete('/:id', (c) => {
  return c.json({ message: 'Upload deleted' });
});

export default uploads;
