const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CertificadoFinalMiembro } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/certificados_finales_miembros');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); 
  }
});

const upload = multer({ storage });

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
      console.error('Error al guardar certificado final del miembro:', error);
      res.status(500).json({ error: 'Error interno al registrar certificado' });
    }
  }
);

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
      console.error(' Error al obtener certificados del grupo:', error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  }
);

router.get('/:trabajo_id/:codigo',
  async (req, res) => {
    try {
      const { trabajo_id, codigo } = req.params;

      const cert = await CertificadoFinalMiembro.findOne({
        where: { trabajo_id, codigo_universitario: codigo },
        attributes: ['nombre_archivo_pdf']
      });

      if (!cert) {
        return res.status(404).json({ message: 'Certificado del miembro no encontrado' });
      }

      const rutaPDF = path.join(__dirname, '../uploads/certificados_finales_miembros', cert.nombre_archivo_pdf);

      if (!fs.existsSync(rutaPDF)) {
        return res.status(404).json({ message: 'Archivo PDF no existe en el servidor' });
      }

      res.setHeader('Content-Disposition', `inline; filename="certificado_final_miembro.pdf"`);
      res.setHeader('Content-Type', 'application/pdf');
      return res.sendFile(rutaPDF);

    } catch (error) {
      console.error('Error al servir certificado final del miembro:', error);
      return res.status(500).json({ message: 'Error interno al servir certificado final del miembro' });
    }
  }
);



module.exports = router;
