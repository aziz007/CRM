function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'A record with this value already exists' });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
  }
  return res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
  });
}

module.exports = { notFound, errorHandler };
