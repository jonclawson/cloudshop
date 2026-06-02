import { Hono } from 'hono';
import { verifyJWT } from '../middleware/auth';
import { getDb, schema } from '../db';

type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  USE_MOCKS?: string;
  JWT_SECRET?: string;

  KV: KVNamespace;
  R2: R2Bucket;

  STRIPE_SECRET_KEY?: string;
  PRINTFUL_API_KEY?: string;
  MAILCHANNELS_API_KEY?: string;
};

const uploads = new Hono<{ Bindings }>();

type UploadDesignName = 'thumb' | 'print';

type FileLike = { name: string; size: number; type: string };

function isFileLike(value: unknown): value is FileLike {
  if (typeof value === 'string' || value === null) return false;
  if (typeof value !== 'object') return false;

  const v = value as { name?: unknown; size?: unknown; type?: unknown };
  return (
    typeof v.name === 'string' &&
    typeof v.size === 'number' &&
    typeof v.type === 'string'
  );
}

function getDesignName(value: unknown): UploadDesignName {
  const raw = typeof value === 'string' ? value : '';
  return raw === 'print' ? 'print' : 'thumb';
}

function getFileExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  if (i === -1) return '';
  return filename.slice(i).toLowerCase();
}

uploads.post('/', verifyJWT, async (c) => {
  const auth = c.get('auth') as { userId: string } | undefined;
  const userId = auth?.userId;

  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const formData = await c.req.formData();
  const fileEntry = formData.get('file');
  const designName = getDesignName(formData.get('design_name'));

  if (!isFileLike(fileEntry)) {
    return c.json({ error: 'File required' }, 400);
  }

  // Upload bytes (formData.get('file') in Workers is a File-like object)
  const arrayBuffer = await (fileEntry as any as File).arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);

  const uploadId = crypto.randomUUID();
  const ext = getFileExtension(fileEntry.name);
  const key = `designs/user/${userId}/${uploadId}/${designName}${ext}`;

  const contentType = fileEntry.type || 'application/octet-stream';

  await c.env.R2.put(key, fileBytes, {
    httpMetadata: {
      contentType,
    },
  });

  // Private bucket: we store a URL to our proxy endpoint.
  const origin = new URL(c.req.url).origin;
  const fileUrl = `${origin}/api/uploads/file/${encodeURIComponent(key)}`;

  const db = getDb(c.env.DB);
  const uploadIdInDb = crypto.randomUUID();

  await db.insert(schema.userUploads).values({
    id: uploadIdInDb,
    user_id: userId,
    design_name: designName,
    file_key: key,
    file_url: fileUrl,
    file_size: fileEntry.size,
  });

  return c.json(
    {
      user_upload_id: uploadIdInDb,
      design_name: designName,
      file_key: key,
      file_url: fileUrl,
      file_size: fileEntry.size,
      created_at: new Date().toISOString(),
    },
    201
  );
});

uploads.get('/file/:file_key', async (c) => {
  const fileKey = c.req.param('file_key');

  if (!fileKey) return c.json({ error: 'file_key required' }, 400);

  const obj = await c.env.R2.get(fileKey);

  if (!obj) {
    return c.json({ error: 'File not found' }, 404);
  }

  const contentType = obj.httpMetadata?.contentType ?? 'application/octet-stream';

  return new Response(obj.body, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
});

// (Optional) List / delete endpoints (not used by this flow yet)
uploads.get('/', verifyJWT, async (c) => {
  const auth = c.get('auth') as { userId: string } | undefined;
  const userId = auth?.userId;

  if (!userId) return c.json({ uploads: [], total: 0, page: 1 });

  // For now keep it simple—return empty list to avoid needing pagination/UI.
  return c.json({ uploads: [], total: 0, page: 1 });
});

uploads.delete('/:id', verifyJWT, async (c) => {
  // TODO: implement deletion properly when needed.
  return c.json({ message: 'Upload deletion not implemented' }, 501);
});

export default uploads;
