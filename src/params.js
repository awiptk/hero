const DEFAULT_QUALITY = 40

function normalizeTarget(raw) {
  if (!raw) return null;
  // Trim leading slashes
  let t = raw.replace(/^\/+/, '');
  // Fix single-slash after protocol like https:/example.com -> https://example.com
  t = t.replace(/^(https?:)\/+([^/])/, (m, p1, p2) => p1 + '://' + p2);
  return t;
}

function params(req, res, next) {
  // Support both ?url=... and path-style /https:/...
  let url = req.query.url;
  if (Array.isArray(url)) url = url.join('&url=');

  if (!url) {
    // try to parse from path: req.originalUrl may contain query string; use it
    const rawPath = (req.originalUrl || req.url || '').split('?')[0] || '';
    const candidate = rawPath.replace(/^\/+/, '');
    if (/^https?:\/+/i.test(candidate) || /^https?:\/[^/]/i.test(candidate)) {
      url = normalizeTarget(candidate);
    }
  } else {
    url = normalizeTarget(url);
  }

  if (!url) return res.end('bandwidth-hero-proxy');

  if (!/^https?:\/\//i.test(url)) {
    url = url.replace(/^https?:\/+/, match => match.replace(/:\/*/, '://'));
  }

  req.params.url = url;
  req.params.webp = !req.query.jpeg;
  req.params.grayscale = req.query.bw != 0;
  req.params.quality = parseInt(req.query.l, 10) || DEFAULT_QUALITY;

  next();
}

module.exports = params
