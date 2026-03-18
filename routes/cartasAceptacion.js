const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CartaAceptacion, IntegranteGrupo } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/cartas_aceptacion');
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

router.post(
  '/',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh'),
  upload.single('archivo'),
  async (req, res) => {
    try {
      const { trabajo_id, codigo_universitario } = req.body;
      const archivo = req.file;

      const trabajoIdNum = Number(trabajo_id);
      const codigo = String(codigo_universitario || '').trim();

      if (!Number.isInteger(trabajoIdNum) || trabajoIdNum <= 0) {
        return res.status(400).json({ error: 'trabajo_id invalido' });
      }

      if (!/^\d{10}$/.test(codigo)) {
        return res.status(400).json({ error: 'codigo_universitario invalido' });
      }

      if (!archivo) {
        return res.status(400).json({ error: 'Falta el archivo PDF' });
      }

      const integrante = await IntegranteGrupo.findOne({
        where: {
          trabajo_social_id: trabajoIdNum,
          codigo
        }
      });

      if (!integrante) {
        return res.status(404).json({
          error: 'El integrante no pertenece al trabajo social indicado'
        });
      }

      const nuevaCarta = await CartaAceptacion.create({
        trabajo_id: trabajoIdNum,
        codigo_universitario: codigo,
        nombre_archivo_pdf: archivo.filename
      });

      return res.status(201).json(nuevaCarta);
    } catch (error) {
      console.error('Error al guardar carta:', error);
      return res.status(500).json({ error: 'Error interno al registrar carta' });
    }
  }
);

router.get('/grupo/:trabajo_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
    const { trabajo_id } = req.params;
    try {
      const [cartas, integrantes] = await Promise.all([
        CartaAceptacion.findAll({
          where: { trabajo_id },
          attributes: ['nombre_archivo_pdf', 'codigo_universitario']
        }),
        IntegranteGrupo.findAll({
          where: { trabajo_social_id: trabajo_id },
          attributes: ['correo_institucional', 'nombre_completo']
        })
      ]);

      // Mapa codigo -> nombre_completo
      const nombrePorCodigo = {};
      for (const ig of integrantes) {
        const codigo = (ig.correo_institucional || '').split('@')[0];
        if (codigo) nombrePorCodigo[codigo] = ig.nombre_completo;
      }

      const resultado = cartas.map((carta) => ({
        nombre_archivo_pdf: carta.nombre_archivo_pdf,
        codigo_universitario: carta.codigo_universitario,
        nombre_completo: nombrePorCodigo[carta.codigo_universitario] || null
      }));

      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al obtener cartas del grupo:', error);
      res.status(500).json({ message: 'Error del servidor' });
    }
  }
);

module.exports = router;
