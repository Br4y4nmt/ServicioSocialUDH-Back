const express = require('express');
const router = express.Router();
const LaboresSociales = require('../models/LaboresSociales');
const LineaDeAccion = require('../models/LineaDeAccion'); 
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');


router.post('/',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const { nombre_labores, linea_id } = req.body;

    const nuevaLabor = await LaboresSociales.create({
      nombre_labores,
      linea_accion_id: linea_id
    });

    res.status(201).json(nuevaLabor);
  } catch (error) {
    console.error('Error al crear la labor social:', error);
    res.status(500).json({ message: 'Error al crear la labor social', error });
  }
});


router.get('/',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor', 'alumno', 'programa-academico'),
  async (req, res) => {
  try {
    const labores = await LaboresSociales.findAll({
    include: {
      model: LineaDeAccion,
      as: 'LineaAccion',
      attributes: ['nombre_linea']
    }
  });
    res.status(200).json(labores);
  } catch (error) {
    console.error('Error al obtener labores sociales:', error);
    res.status(500).json({ message: 'Error al obtener labores sociales', error });
  }
});


// Obtener una labor social por ID
router.get('/:id_labores',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor', 'alumno', 'programa-academico'),
  async (req, res) => {
  try {
    const labores = await LaboresSociales.findAll({
    include: {
      model: LineaDeAccion,
      as: 'LineaAccion', 
      attributes: ['nombre_linea']
    }
  });

    if (labor) {
      res.status(200).json(labor);
    } else {
      res.status(404).json({ message: 'Labor social no encontrada' });
    }
  } catch (error) {
    console.error('Error al obtener la labor social:', error);
    res.status(500).json({ message: 'Error al obtener la labor social', error });
  }
});


// Actualizar una labor social
router.put('/:id_labores',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const labor = await LaboresSociales.findByPk(req.params.id_labores);
    if (labor) {
      const { nombre_labores, linea_id } = req.body;
      await labor.update({ nombre_labores, linea_accion_id: linea_id  });
      res.status(200).json(labor);
    } else {
      res.status(404).json({ message: 'Labor social no encontrada' });
    }
  } catch (error) {
    console.error('Error al actualizar la labor social:', error);
    res.status(500).json({ message: 'Error al actualizar la labor social', error });
  }
});


// Eliminar una labor social
router.delete('/:id_labores',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const labor = await LaboresSociales.findByPk(req.params.id_labores);
    if (!labor) {
      return res.status(404).json({ message: 'Labor social no encontrada' });
    }

    await labor.destroy();
    res.status(200).json({ message: 'Labor social eliminada exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar la labor social:', error);
    res.status(500).json({ message: 'Error al eliminar la labor social', error });
  }
});

router.get('/linea/:id_linea',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor', 'alumno', 'programa-academico'),
  async (req, res) => {
  const { id_linea } = req.params;

  try {
    const labores = await LaboresSociales.findAll({
      where: { linea_accion_id: id_linea }
    });
    res.status(200).json(labores);
  } catch (error) {
    console.error('Error al obtener labores por línea de acción:', error);
    res.status(500).json({ error: 'Error al obtener labores' });
  }
});

module.exports = router;
