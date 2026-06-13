export type R2PresignedUrlEnv = {
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
};
export async function generateR2PresignedUrl(
  env: R2PresignedUrlEnv,
  fileKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error('R2_PRESIGNED_URL_MISCONFIGURED');
  }

  // Ensure the file key doesn't have an accidental leading slash
  const cleanKey = fileKey.startsWith('/') ? fileKey.slice(1) : fileKey;

  const url = new URL(
    `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${cleanKey}`
  );

  const datetime = new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
  const date = datetime.slice(0, 8);

  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Credential', `${R2_ACCESS_KEY_ID}/${date}/auto/s3/aws4_request`);
  url.searchParams.set('X-Amz-Date', datetime);
  url.searchParams.set('X-Amz-Expires', expiresIn.toString());
  url.searchParams.set('X-Amz-SignedHeaders', 'host');

  const encoder = new TextEncoder();

  // HMAC helper using Web Crypto API
  const hmac = async (key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> => {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      typeof key === 'string' ? encoder.encode(key) : key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  };

  // Helper for AWS-compliant percent encoding
  const awsEncode = (str: string) =>
    encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

  // FIX 1: Safely encode path segments while preserving forward slashes
  const canonicalUri = '/' + [R2_BUCKET_NAME, ...cleanKey.split('/')].map(awsEncode).join('/');

  // FIX 2: Ensure individual query strings are uniformly sorted and encoded
  const canonicalQueryString = Array.from(url.searchParams.entries())
    .map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`)
    .sort()
    .join('&');

  // Build canonical request
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQueryString,
    `host:${url.host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const canonicalRequestHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)))
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    `${date}/auto/s3/aws4_request`,
    canonicalRequestHash,
  ].join('\n');

  // Derive signing key
  const kDate = await hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, date);
  const kRegion = await hmac(kDate, 'auto');
  const kService = await hmac(kRegion, 's3');
  const kSigning = await hmac(kService, 'aws4_request');

  const signature = Array.from(new Uint8Array(await hmac(kSigning, stringToSign)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  url.searchParams.set('X-Amz-Signature', signature);
  return url.toString();
}

// /**
//  * Generates an S3-compatible presigned URL for an R2 object using the Web Crypto API.
//  * This allows Printful to fetch the file directly from R2 with time-limited access,
//  * while keeping the R2 bucket completely private.
//  *
//  * Uses only Web APIs supported by Cloudflare Workers (no Node.js dependencies).
//  */

// export type R2PresignedUrlEnv = {
//   R2_ACCOUNT_ID?: string;
//   R2_ACCESS_KEY_ID?: string;
//   R2_SECRET_ACCESS_KEY?: string;
//   R2_BUCKET_NAME?: string;
// };

// /**
//  * Generates a presigned GET URL for an R2 object valid for the specified duration.
//  *
//  * @param env - Environment variables containing R2 credentials and bucket name
//  * @param fileKey - The R2 object key (path)
//  * @param expiresIn - Time in seconds until the URL expires (default: 3600)
//  * @returns A presigned URL string
//  * @throws Error if R2 credentials are missing or if signing fails
//  */
// export async function generateR2PresignedUrl(
//   env: R2PresignedUrlEnv,
//   fileKey: string,
//   expiresIn: number = 3600
// ): Promise<string> {
//   const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env;

//   if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
//     throw new Error('R2_PRESIGNED_URL_MISCONFIGURED');
//   }

//   const url = new URL(
//     `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${fileKey}`
//   );

//   const datetime = new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
//   const date = datetime.slice(0, 8);

//   url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
//   url.searchParams.set('X-Amz-Credential', `${R2_ACCESS_KEY_ID}/${date}/auto/s3/aws4_request`);
//   url.searchParams.set('X-Amz-Date', datetime);
//   url.searchParams.set('X-Amz-Expires', expiresIn.toString());
//   url.searchParams.set('X-Amz-SignedHeaders', 'host');

//   const encoder = new TextEncoder();

//   // HMAC helper using Web Crypto API
//   const hmac = async (key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> => {
//     const cryptoKey = await crypto.subtle.importKey(
//       'raw',
//       typeof key === 'string' ? encoder.encode(key) : key,
//       { name: 'HMAC', hash: 'SHA-256' },
//       false,
//       ['sign']
//     );
//     return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
//   };

//   // Build canonical request
//   const encodedKey = encodeURIComponent(fileKey);
//   const canonicalQueryString = Array.from(url.searchParams.entries())
//     .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
//     .sort()
//     .join('&');

//   const canonicalRequest = [
//     'GET',
//     `/${R2_BUCKET_NAME}/${encodedKey}`,
//     canonicalQueryString,
//     `host:${url.host}`,
//     '',
//     'host',
//     'UNSIGNED-PAYLOAD',
//   ].join('\n');

//   const canonicalRequestHash = Array.from(
//     new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)))
//   )
//     .map((b) => b.toString(16).padStart(2, '0'))
//     .join('');

//   const stringToSign = [
//     'AWS4-HMAC-SHA256',
//     datetime,
//     `${date}/auto/s3/aws4_request`,
//     canonicalRequestHash,
//   ].join('\n');

//   // Derive signing key
//   const kDate = await hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, date);
//   const kRegion = await hmac(kDate, 'auto');
//   const kService = await hmac(kRegion, 's3');
//   const kSigning = await hmac(kService, 'aws4_request');

//   const signature = Array.from(new Uint8Array(await hmac(kSigning, stringToSign)))
//     .map((b) => b.toString(16).padStart(2, '0'))
//     .join('');

//   url.searchParams.set('X-Amz-Signature', signature);
//   return url.toString();
// }