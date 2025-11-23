const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const Usuario = require('../models/Usuario');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');


router.get('/',
  authMiddleware,
  verificarRol('gestor-udh','programa-academico'),
  async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.status(200).json(usuario);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});


router.get('/:id',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor','programa-academico'),
  async (req, res) => {
  try {
    const usuarios = await Usuario.findAll();
    res.status(200).json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener los usuarios' });
  }
});


router.delete('/:id',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    await usuario.destroy();
    res.status(200).json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});


router.put('/:id',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    const { nombre, apellido, email, rol_id } = req.body;
    await usuario.update({ nombre, apellido, email, rol_id });

    res.status(200).json({ message: 'Usuario actualizado correctamente', usuario });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});



router.post('/',
  authMiddleware,
  verificarRol('gestor-udh','programa-academico'),
  async (req, res) => {
  const { email, dni, whatsapp } = req.body; 

  if (!email || !dni || !whatsapp) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  try {
    const usuarioExistente = await Usuario.findOne({
      where: {
        [Op.or]: [{ email }, { dni }] 
      }
    });

    if (usuarioExistente) {
      return res.status(400).json({ message: 'El usuario con ese email o DNI ya existe' });
    }

    const nuevoUsuario = await Usuario.create({
      email,
      dni,
      whatsapp,
      rol_id: 2 
    });

    res.status(201).json({ message: 'Usuario creado exitosamente', nuevoUsuario });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
});



router.get('/:id_usuario',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor','programa-academico'),
  async (req, res) => {
  const { id_usuario } = req.params;

  try {
    const usuario = await Usuario.findByPk(id_usuario);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(usuario);
  } catch (error) {
    console.error('Error al obtener el usuario:', error);
    res.status(500).json({ message: 'Error al obtener el usuario' });
  }
});


router.get('/:id_usuario/primera-vez', async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id_usuario);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.status(200).json({ primera_vez: usuario.primera_vez });
  } catch (error) {
    console.error('Error al verificar primera vez:', error);
    res.status(500).json({ message: 'Error al verificar primera vez' });
  }
});
module.exports = router;
