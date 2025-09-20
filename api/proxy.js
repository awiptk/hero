// api/proxy.js
module.exports = async (req, res) => {
  // CORS (jika Anda ingin diakses dari browser)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Ambil url dari ?url= atau dari path-style /https:/...
  function normalize(raw) {
    if (!raw) return null;
    // jika berupa array -> gabungkan
    if (Array.isArray(raw)) raw = raw.join('&url=');
    // hapus leading slashes
    raw = String(raw).replace(/^\/+/, '');
    // fix single-slash after protocol: https:/example.com -> https://example.com
    raw = raw.replace(/^(https?:)\/+([^/])/, (m, p1, p2) => p1 + '://' + p2);
    return raw;
  }

  let target = normalize(req.query && req.query.url);
  if (!target) {
    // contoh path: /https:/example.com/path.jpg  atau /https://example.com/...
    const rawPath = (req.originalUrl || req.url || '').split('?')[0] || '';
    const candidate = rawPath.replace(/^\/+/, '');
    if (/^https?:\/+/i.test(candidate) || /^https?:\/[^/]/i.test(candidate)) {
      target = normalize(candidate);
    }
  }

  if (!target) {
    res.statusCode = 400;
    return res.end('Missing target URL. Usage: /?url=https://example.com/image.jpg or /https:/example.com/image.jpg');
  }

  try {
    // build headers to upstream (some server require referer/user-agent)
    const upstreamHeaders = {};
    // carry some headers from client (optional)
    if (req.headers.cookie) upstreamHeaders.cookie = req.headers.cookie;
    // set User-Agent to look like a browser
    upstreamHeaders['user-agent'] = req.headers['user-agent'] || 'Mozilla/5.0 (compatible; Bandwidth-Hero/1.0)';
    // set referer to origin of target if none provided
    try {
      const u = new URL(target);
      upstreamHeaders.referer = req.headers.referer || u.origin;
      // some servers treat absence of origin specially; include Origin too
      upstreamHeaders.origin = req.headers.origin || u.origin;
    } catch(e) {}

    // Avoid sending Accept-Encoding so upstream returns bytes we can forward unmodified (optional)
    // upstreamHeaders['accept-encoding'] = 'identity';

    // Use global fetch (Node 18+/Vercel runtime)
    const upstream = await fetch(target, {
      method: 'GET',
      headers: upstreamHeaders,
      redirect: 'follow'
    });

    // If upstream returns 4xx/5xx, forward status and a short message (but still include body for debugging)
    const status = upstream.status || 502;
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';

    // Stream/pipe the response body.
    const buffer = Buffer.from(await upstream.arrayBuffer());

    // copy useful headers
    res.setHeader('Content-Type', contentType);
    const cl = upstream.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);

    // optional: forward caching headers (careful with private data)
    const cacheControl = upstream.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    res.statusCode = status;
    return res.end(buffer);
  } catch (err) {
    console.error('Proxy error:', err);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('Bad gateway: ' + (err && err.message));
  }
};
