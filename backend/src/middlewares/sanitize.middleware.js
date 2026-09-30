/**
 * Removes MongoDB operator keys (anything starting with "$") from request input, in place,
 * so payloads like {"email": {"$ne": null}} can never reach a query as an operator object.
 */
const strip = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 10 || Buffer.isBuffer(value)) return;
  if (Array.isArray(value)) {
    value.forEach((item) => strip(item, depth + 1));
    return;
  }
  for (const key of Object.keys(value)) {
    if (key.startsWith('$')) {
      delete value[key];
    } else {
      strip(value[key], depth + 1);
    }
  }
};

export const sanitizeRequest = (req, res, next) => {
  strip(req.body);
  strip(req.params);
  strip(req.query);
  next();
};

export default sanitizeRequest;
