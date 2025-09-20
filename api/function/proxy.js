const authenticate = require('../../src/authenticate');
const params = require('../../src/params');
const proxy = require('../../src/proxy');

module.exports = async (req, res) => {
  req.params = req.params || {};
  req.ip = req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '';

  const runMiddleware = (mw) => new Promise((resolve) => {
    try { mw(req, res, resolve); } catch (err) { console.error('Middleware error', err); resolve(); }
  });

  await runMiddleware(authenticate);
  if (res.headersSent) return;
  await runMiddleware(params);
  if (res.headersSent) return;

  try {
    await proxy(req, res);
  } catch (err) {
    console.error('Proxy handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type','text/plain');
      res.end('Bad gateway: ' + (err && err.message));
    }
  }
};
