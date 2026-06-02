import { Hono } from 'hono';

type Bindings = {
  ENVIRONMENT?: string;
};

const imageProxy = new Hono<{ Bindings }>();

function isValidHttpUrl(maybeUrl: string): boolean {
  try {
    const url = new URL(maybeUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

imageProxy.get('/', async (c) => {
  const url = c.req.query('url');

  if (!url || typeof url !== 'string') {
    return c.json({ error: 'url query param required' }, 400);
  }

  if (!isValidHttpUrl(url)) {
    return c.json({ error: 'Invalid url' }, 400);
  }

  try {
    const resp = await fetch(url, {
      redirect: 'follow',
    });

    if (!resp.ok) {
      return c.json({ error: 'Failed to fetch image', status: resp.status }, 502);
    }

    const contentType =
      resp.headers.get('content-type') || 'application/octet-stream';

    // Return the raw bytes; browser will treat it as same-origin so no CORS block.
    return new Response(resp.body, {
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=60',
      },
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch image' }, 502);
  }
});

export default imageProxy;
