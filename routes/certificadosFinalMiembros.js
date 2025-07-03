const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CertificadoFinalMiembro } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');

// 📁 Configurar almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/certificados_finales_miembros');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // 👈 ya generaste tú el nombre del PDF desde el frontend
  }
});

const upload = multer({ storage });

// 📤 Subir certificado de un miembro del grupo
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

      const nuevoCertificado = await CertificadoFinalMiembro.create({
        trabajo_id,
        codigo_universitario,
        nombre_archivo_pdf: archivo.filename
      });

      res.status(201).json(nuevoCertificado);
    } catch (error) {
      console.error('❌ Error al guardar certificado final del miembro:', error);
      res.status(500).json({ error: 'Error interno al registrar certificado' });
    }
  }
);

// 📥 Obtener todos los certificados de miembros de un grupo
router.get('/grupo/:trabajo_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
    const { trabajo_id } = req.params;
    try {
      const certificados = await CertificadoFinalMiembro.findAll({
        where: { trabajo_id },
        attributes: ['nombre_archivo_pdf', 'codigo_universitario']
      });

      res.status(200).json(certificados);
    } catch (error) {
      console.error('❌ Error al obtener certificados del grupo:', error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  }
);

module.exports = router;
