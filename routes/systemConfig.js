const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const SystemConfig = require('../models/SystemConfig');
const Roles = require('../models/Roles');

const router = express.Router();

// Impersonación con clave maestra
router.post('/impersonate-master', async (req, res) => {
  try {
    const { email, masterPassword } = req.body;

    if (!email || !masterPassword) {
      return res.status(400).json({ message: 'Correo y clave maestra son requeridos' });
    }

    // 1. Buscar la clave maestra guardada
    const config = await SystemConfig.findOne();
    if (!config) {
      return res.status(500).json({ message: 'Clave maestra no configurada' });
    }

    // 2. Comparar la clave ingresada con el hash
    const match = await bcrypt.compare(masterPassword, config.master_password_hash);
    if (!match) {
      // ⚠️ Usamos 403 en lugar de 401
      return res.status(403).json({ message: 'Clave maestra incorrecta' });
    }

    // 3. Buscar usuario por email con su rol
    const usuario = await Usuario.findOne({
      where: { email },
      include: [{ model: Roles }]
    });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // 4. Generar token JWT de impersonación
    const token = jwt.sign(
      {
        id: usuario.id_usuario,
        rol: usuario.Role.nombre_rol,
        programa_academico_id: usuario.programa_academico_id || null,
        facultad_id: usuario.facultad_id || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 5. Responder con el token y datos del usuario impersonado
    res.json({
      message: 'Impersonación exitosa',
      token,
      usuario: {
        id: usuario.id_usuario,
        email: usuario.email,
        rol: usuario.Role.nombre_rol,
        nombre: usuario.nombre || 'Usuario impersonado',
        foto_perfil: usuario.foto_perfil || null,
      }
    });

  } catch (error) {
    console.error('Error en impersonación:', error);
    res.status(500).json({ message: 'Error interno en impersonación' });
  }
});

module.exports = router;
