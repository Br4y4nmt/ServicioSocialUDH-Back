const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CertificadoFinalMiembro, IntegranteGrupo} = require('../models');
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

router.post(
  '/',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh'),
  upload.single('archivo'),
  async (req, res) => {
    try {
      const { trabajo_id, codigo_universitario } = req.body;
      const archivo = req.file;

      if (!trabajo_id || !codigo_universitario || !archivo) {
        return res.status(400).json({
          error: 'Faltan campos obligatorios o archivo'
        });
      }

      const trabajoIdNum = Number(trabajo_id);
      const codigo = String(codigo_universitario).trim();

      if (!Number.isInteger(trabajoIdNum) || trabajoIdNum <= 0) {
        return res.status(400).json({ error: 'trabajo_id inválido' });
      }

      if (!/^\d{10}$/.test(codigo)) {
        return res.status(400).json({ error: 'codigo_universitario inválido' });
      }

      if (!archivo.filename) {
        return res.status(400).json({
          error: 'El archivo no tiene filename. Verifica la configuración de multer.'
        });
      }

      const integranteDelGrupo = await IntegranteGrupo.findOne({
        where: {
          trabajo_social_id: trabajoIdNum,
          codigo: codigo
        },
        attributes: [
          'id_integrante',
          'codigo',
          'correo_institucional',
          'nombre_completo',
          'facultad',
          'programa_academico'
        ]
      });

      if (!integranteDelGrupo) {
        return res.status(404).json({
          error: 'El integrante no pertenece a este grupo'
        });
      }

      const existente = await CertificadoFinalMiembro.findOne({
        where: {
          trabajo_id: trabajoIdNum,
          codigo_universitario: codigo
        }
      });

      let certificadoGuardado;

      if (existente) {
        await existente.update({
          nombre_archivo_pdf: archivo.filename
        });
        certificadoGuardado = existente;
      } else {
        certificadoGuardado = await CertificadoFinalMiembro.create({
          trabajo_id: trabajoIdNum,
          codigo_universitario: codigo,
          nombre_archivo_pdf: archivo.filename
        });
      }

      return res.status(201).json({
        ...certificadoGuardado.toJSON(),
        integrante: {
          nombre_completo: integranteDelGrupo.nombre_completo,
          codigo: integranteDelGrupo.codigo,
          correo_institucional: integranteDelGrupo.correo_institucional,
          facultad: integranteDelGrupo.facultad,
          programa_academico: integranteDelGrupo.programa_academico
        }
      });
    } catch (error) {
      console.error('Error al guardar certificado final del miembro:', error);
      return res.status(500).json({
        error: 'Error interno al registrar certificado',
        detalle: error.message
      });
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
        return res.status(400).json({ error: 'trabajo_id inválido' });
      }

      const [certificados, integrantes] = await Promise.all([
        CertificadoFinalMiembro.findAll({
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
        const codigo = String(integrante.correo_institucional || '')
          .split('@')[0]
          .trim();

        if (codigo) {
          nombrePorCodigo[codigo] = integrante.nombre_completo || null;
        }
      }

      const resultado = certificados.map((certificado) => {
        const codigo = String(certificado.codigo_universitario || '').trim();

        return {
          nombre_archivo_pdf: certificado.nombre_archivo_pdf,
          codigo_universitario: codigo,
          nombre_completo: nombrePorCodigo[codigo] || null
        };
      });

      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al obtener certificados del grupo:', error);
      return res.status(500).json({ error: 'Error del servidor' });
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
