import { Hono } from 'hono';

const uploads = new Hono();

uploads.post('/', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const designName = (formData.get('design_name') as string) || 'Untitled';

  if (!file) {
    return c.json({ error: 'File required' }, 400);
  }

  return c.json({
    id: 'upload-123',
    file_key: `designs/user/${file.name}`,
    file_url: `https://r2.example.com/designs/user/${file.name}`,
    design_name: designName,
    file_size: file.size,
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
