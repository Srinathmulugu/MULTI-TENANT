export function requireRole(...allowedRoles) {
  return (request, response, next) => {
    if (!request.user) {
      response.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      response.status(403).json({ error: 'Forbidden for current role.' });
      return;
    }

    next();
  };
}
