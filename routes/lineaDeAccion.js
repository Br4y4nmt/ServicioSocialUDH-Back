const express = require('express');
const router = express.Router();
const LineaDeAccion = require('../models/LineaDeAccion');
const LaboresSociales = require('../models/LaboresSociales'); // para incluir en GET
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
// Crear nueva línea de acción
router.post('/',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
  try {
    const { nombre_linea } = req.body;
    const nuevaLinea = await LineaDeAccion.create({ nombre_linea });
    res.status(201).json(nuevaLinea);
  } catch (error) {
    console.error('Error al crear la línea de acción:', error);
    res.status(500).json({ message: 'Error al crear la línea de acción', error });
  }
});

// Obtener todas las líneas de acción con sus labores sociales
router.get('/',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor', 'alumno', 'programa-academico'),
  async (req, res) => {
  try {
    const lineas = await LineaDeAccion.findAll({
      include: {
        model: LaboresSociales,
        attributes: ['id_labores', 'nombre_labores']
      }
    });
    res.status(200).json(lineas);
  } catch (error) {
    console.error('Error al obtener líneas de acción:', error);
    res.status(500).json({ message: 'Error al obtener líneas de acción', error });
  }
});

// Obtener línea de acción por ID
router.get('/:id_linea',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor', 'alumno', 'programa-academico'),
  async (req, res) => {
  try {
    const linea = await LineaDeAccion.findByPk(req.params.id_linea, {
      include: {
        model: LaboresSociales,
        attributes: ['id_labores', 'nombre_labores']
      }
    });

    if (linea) {
      res.status(200).json(linea);
    } else {
      res.status(404).json({ message: 'Línea de acción no encontrada' });
    }
  } catch (error) {
    console.error('Error al obtener la línea de acción:', error);
    res.status(500).json({ message: 'Error al obtener la línea de acción', error });
  }
});

// Actualizar línea de acción
router.put('/:id_linea',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
  try {
    const linea = await LineaDeAccion.findByPk(req.params.id_linea);
    if (linea) {
      const { nombre_linea } = req.body;
      await linea.update({ nombre_linea });
      res.status(200).json(linea);
    } else {
      res.status(404).json({ message: 'Línea de acción no encontrada' });
    }
  } catch (error) {
    console.error('Error al actualizar la línea de acción:', error);
    res.status(500).json({ message: 'Error al actualizar la línea de acción', error });
  }
});

// Eliminar línea de acción
router.delete('/:id_linea',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
  try {
    const linea = await LineaDeAccion.findByPk(req.params.id_linea);
    if (!linea) {
      return res.status(404).json({ message: 'Línea de acción no encontrada' });
    }

    await linea.destroy();
    res.status(200).json({ message: 'Línea de acción eliminada exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar la línea de acción:', error);
    res.status(500).json({ message: 'Error al eliminar la línea de acción', error });
  }
});

module.exports = router;
