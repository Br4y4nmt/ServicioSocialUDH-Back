const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  console.log('🔐 Token recibido:', token);
  if (!token) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decodificado:', decoded); 
    req.user = decoded; // Guarda datos del usuario
    req.userRole = decoded.rol; // 👈 Agrega el rol para el middleware de roles
    next();
  } catch (error) {
    console.error('Token inválido:', error);
    return res.status(403).json({ message: 'Token inválido' });
  }
};

module.exports = authMiddleware;