const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CartaTermino, IntegranteGrupo } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/cartas_termino_integrantes');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
  const ext = path.extname(file.originalname); 
  const timestamp = Date.now();
  cb(null, `carta_termino_${timestamp}${ext}`);
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

      const trabajoIdNum = Number(trabajo_id);
      const codigo = String(codigo_universitario).trim();

      if (!Number.isInteger(trabajoIdNum) || trabajoIdNum <= 0) {
        return res.status(400).json({ error: 'trabajo_id inválido' });
      }

      if (!/^\d{10}$/.test(codigo)) {
        return res.status(400).json({ error: 'codigo_universitario inválido' });
      }

      const correoCodigo = `${codigo}@udh.edu.pe`;

      const integrante = await IntegranteGrupo.findOne({
        where: {
          trabajo_social_id: trabajoIdNum,
          correo_institucional: correoCodigo
        },
        attributes: ['id_integrante', 'nombre_completo', 'correo_institucional', 'facultad', 'programa_academico']
      });

      if (!integrante) {
        return res.status(404).json({
          error: 'Integrante no encontrado en el grupo para este trabajo social'
        });
      }

      const existente = await CartaTermino.findOne({
        where: {
          trabajo_id: trabajoIdNum,
          codigo_universitario: codigo
        }
      });

      let cartaGuardada;
      if (existente) {
        await existente.update({ nombre_archivo_pdf: archivo.filename });
        cartaGuardada = existente;
      } else {
        cartaGuardada = await CartaTermino.create({
          trabajo_id: trabajoIdNum,
          codigo_universitario: codigo,
          nombre_archivo_pdf: archivo.filename
        });
      }

      return res.status(existente ? 200 : 201).json({
        ...cartaGuardada.toJSON(),
        integrante: {
          nombre_completo: integrante.nombre_completo,
          correo_institucional: integrante.correo_institucional,
          facultad: integrante.facultad,
          programa_academico: integrante.programa_academico
        }
      });
    } catch (error) {
      console.error('Error al guardar carta de término:', error);
      return res.status(500).json({ error: 'Error interno al registrar carta de término' });
    }
  }
);

router.get('/grupo/:trabajo_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
    const { trabajo_id } = req.params;

    try {
      const idTrabajo = Number(trabajo_id);
      if (!Number.isInteger(idTrabajo) || idTrabajo <= 0) {
        return res.status(400).json({ message: 'trabajo_id inválido' });
      }

      const [cartas, integrantes] = await Promise.all([
        CartaTermino.findAll({
          where: { trabajo_id: idTrabajo },
          attributes: ['nombre_archivo_pdf', 'codigo_universitario']
        }),
        IntegranteGrupo.findAll({
          where: { trabajo_social_id: idTrabajo },
          attributes: ['correo_institucional', 'nombre_completo']
        })
      ]);

      const nombrePorCodigo = {};
      for (const integrante of integrantes) {
        const codigo = String(integrante.correo_institucional || '').split('@')[0]?.trim();
        if (codigo) {
          nombrePorCodigo[codigo] = integrante.nombre_completo || null;
        }
      }

      const resultado = cartas.map((carta) => {
        const codigo = String(carta.codigo_universitario || '').trim();
        return {
          nombre_archivo_pdf: carta.nombre_archivo_pdf,
          codigo_universitario: codigo,
          nombre_completo: nombrePorCodigo[codigo] || null
        };
      });

      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al obtener cartas del grupo:', error);
      return res.status(500).json({ message: 'Error del servidor' });
    }
  }
);

module.exports = router;
