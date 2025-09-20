module.exports = (req, res) => {
  // redirect root requests to the serverless function, preserve query string and path
  const q = req.url || '';
  res.writeHead(307, { Location: '/api/function/proxy' + q });
  res.end();
};
