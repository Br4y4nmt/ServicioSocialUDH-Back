const express = require('express');
const router = express.Router();
const Facultades = require('../models/Facultades');  // Importa el modelo de Facultades
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
// Crear una nueva facultad
router.post('/',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
  try {
    const { nombre_facultad } = req.body;

    const nuevaFacultad = await Facultades.create({
      nombre_facultad
    });

    res.status(201).json(nuevaFacultad);
  } catch (error) {
    console.error('Error al crear facultad:', error);
    res.status(500).json({ message: 'Error al crear facultad', error });
  }
});

// Obtener todas las facultades
router.get('/',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor', 'alumno', 'programa-academico'),
  async (req, res) => {
  try {
    const facultades = await Facultades.findAll();
    res.status(200).json(facultades);
  } catch (error) {
    console.error('Error al obtener facultades:', error);
    res.status(500).json({ message: 'Error al obtener facultades', error });
  }
});

// Obtener una facultad por ID
router.get('/:id_facultad',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor', 'alumno', 'programa-academico'),
  async (req, res) => {
  try {
    const facultad = await Facultades.findByPk(req.params.id_facultad);
    if (facultad) {
      res.status(200).json(facultad);
    } else {
      res.status(404).json({ message: 'Facultad no encontrada' });
    }
  } catch (error) {
    console.error('Error al obtener facultad:', error);
    res.status(500).json({ message: 'Error al obtener facultad', error });
  }
});

// Actualizar una facultad por ID
router.put('/:id_facultad',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
  try {
    const facultad = await Facultades.findByPk(req.params.id_facultad);
    if (facultad) {
      const { nombre_facultad } = req.body;
      await facultad.update({ nombre_facultad });
      res.status(200).json(facultad);
    } else {
      res.status(404).json({ message: 'Facultad no encontrada' });
    }
  } catch (error) {
    console.error('Error al actualizar facultad:', error);
    res.status(500).json({ message: 'Error al actualizar facultad', error });
  }
});

// Eliminar una facultad por ID
router.delete('/:id_facultad', async (req, res) => {
  try {
    const { id_facultad } = req.params;

    const facultad = await Facultades.findByPk(id_facultad);
    if (!facultad) {
      return res.status(404).json({ message: 'Facultad no encontrada' });
    }

    await facultad.destroy();

    res.status(200).json({ message: 'Facultad eliminada exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar facultad:', error);
    res.status(500).json({ message: 'Error al eliminar facultad', error });
  }
});

module.exports = router;
