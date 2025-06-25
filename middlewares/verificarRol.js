const verificarRol = (...rolesPermitidos) => (req, res, next) => {
    if (!rolesPermitidos.includes(req.userRole)) {
      return res.status(403).json({ message: 'No tienes permiso para acceder a esta ruta' });
    }
    next();
  };
  
  module.exports = verificarRol;
  