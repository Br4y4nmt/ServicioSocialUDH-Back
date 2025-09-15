const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.userRole = decoded.rol;
    next();
  } catch (error) {
    console.error('Token inválido:', error);

    if (error.name === 'TokenExpiredError') {
      // 👈 Token expirado
      return res.status(401).json({ message: 'Token expirado' });
    }

    return res.status(403).json({ message: 'Token inválido' });
  }
};

module.exports = authMiddleware;
