const express = require('express');
const router = express.Router();
const Infracciones = require('../models/Infracciones');  // Asegúrate de que el modelo está correctamente importado

// Ruta para obtener todas las infracciones
router.get('/', async (req, res) => {
  try {
    const infracciones = await Infracciones.findAll({
      attributes: ['codigo', 'monto','calificacion']  // Incluye todos los campos necesarios
    });
    res.status(200).json(infracciones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener infracciones', error: error.message });
  }
});

module.exports = router;
