const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CartaAceptacion } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
// 📁 Configuración del almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/cartas_aceptacion');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // se guarda como "carta_aceptacion_id_codigo.pdf"
  }
});

const upload = multer({ storage });

// 📤 Ruta para subir y registrar carta
router.post('/',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh'),
  upload.single('archivo'),
  async (req, res) => {
  try {
    const { trabajo_id, codigo_universitario } = req.body;
    const archivo = req.file;

    if (!trabajo_id || !codigo_universitario || !archivo) {
      return res.status(400).json({ error: 'Faltan campos obligatorios o archivo' });
    }

    const nuevaCarta = await CartaAceptacion.create({
      trabajo_id,
      codigo_universitario,
      nombre_archivo_pdf: archivo.filename
    });

    res.status(201).json(nuevaCarta);
  } catch (error) {
    console.error('❌ Error al guardar carta:', error);
    res.status(500).json({ error: 'Error interno al registrar carta' });
  }
});
// routes/cartasAceptacion.js
router.get('/grupo/:trabajo_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  const { trabajo_id } = req.params;
  try {
    const cartas = await CartaAceptacion.findAll({
      where: { trabajo_id },
      attributes: ['nombre_archivo_pdf', 'codigo_universitario']
    });

    res.status(200).json(cartas);
  } catch (error) {
    console.error('Error al obtener cartas del grupo:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
