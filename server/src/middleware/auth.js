import jwt from 'jsonwebtoken';

export function requireAuth(request, response, next) {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    response.status(401).json({ error: 'Missing bearer token.' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    request.user = {
      userId: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role,
      email: payload.email,
      name: payload.name
    };
    next();
  } catch {
    response.status(401).json({ error: 'Invalid or expired token.' });
  }
}
