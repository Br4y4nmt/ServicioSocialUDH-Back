const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const SystemConfig = require('../models/SystemConfig');
const Roles = require('../models/Roles');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const router = express.Router();

// Impersonación con clave maestra
router.post('/impersonate-master', async (req, res) => {
  try {
    const { email, masterPassword } = req.body;

    if (!email || !masterPassword) {
      return res.status(400).json({ message: 'Correo y clave maestra son requeridos' });
    }

    const config = await SystemConfig.findOne();
    if (!config) {
      return res.status(500).json({ message: 'Clave maestra no configurada' });
    }

    const match = await bcrypt.compare(masterPassword, config.master_password_hash);
    if (!match) {
      return res.status(403).json({ message: 'Clave maestra incorrecta' });
    }

    const usuario = await Usuario.findOne({
      where: { email },
      include: [{ model: Roles }]
    });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

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
// ✅ Obtener estado actual del registro (para mostrar en el panel)
router.get('/registro',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
    try {
      const config = await SystemConfig.findByPk(1);

      if (!config) {
        return res.status(404).json({ message: 'Configuración no encontrada' });
      }

      return res.status(200).json({
        registro_habilitado: Number(config.registro_habilitado) === 1
      });
    } catch (error) {
      console.error('Error obteniendo config:', error);
      return res.status(500).json({ message: 'Error obteniendo configuración' });
    }
  }
);

// ✅ Cambiar estado del registro (true/false o 1/0)
router.put('/registro',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
    try {
      const { registro_habilitado } = req.body;

      // Acepta: true/false, 1/0, "1"/"0"
      const nuevoValor = Number(registro_habilitado) === 1 || registro_habilitado === true ? 1 : 0;

      const config = await SystemConfig.findByPk(1);
      if (!config) {
        return res.status(404).json({ message: 'Configuración no encontrada' });
      }

      config.registro_habilitado = nuevoValor;
      config.updated_at = new Date();
      await config.save();

      return res.status(200).json({
        message: 'Configuración actualizada',
        registro_habilitado: Number(config.registro_habilitado) === 1
      });
    } catch (error) {
      console.error('Error actualizando config:', error);
      return res.status(500).json({ message: 'Error actualizando configuración' });
    }
  }
);

module.exports = router;
