const express = require('express');
const multer = require('multer');

const authMiddleware = require('../../../middlewares/authMiddleware');
const verificarRol = require('../../../middlewares/verificarRol');

const {
  healthCheck,
  previsualizarPlanPdf,
  guardarPlanPdf,
  aceptarDesignacion,
  aprobarCartaTermino,
  generarCertificadoFinal,
  obtenerDocumentoCertificadoFinal,
} = require('./controller');

const router = express.Router();

const uploadAnexo = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(
        new Error('Solo se permiten archivos PDF')
      );
    }

    cb(null, true);
  },
});

router.get(
  '/health',
  healthCheck
);

router.post(
  '/plan/previsualizar',
  authMiddleware,
  verificarRol('alumno'),
  uploadAnexo.single('anexo'),
  previsualizarPlanPdf
);

router.post(
  '/plan/guardar',
  authMiddleware,
  verificarRol('alumno'),
  uploadAnexo.single('anexo'),
  guardarPlanPdf
);

router.post(
  '/designacion/:id/aceptar',
  authMiddleware,
  verificarRol('docente supervisor'),
  aceptarDesignacion
);

router.post(
  '/termino/:id/aprobar',
  authMiddleware,
  verificarRol('docente supervisor'),
  aprobarCartaTermino
);

router.post(
  '/informe/:id/certificado-final',
  authMiddleware,
  verificarRol('gestor-udh'),
  generarCertificadoFinal
);

// Sin authMiddleware a propósito: el QR del certificado debe poder
// verificarse públicamente, igual que documentos-trabajo y
// documento-termino.
router.get(
  '/documento-certificado-final/:id',
  obtenerDocumentoCertificadoFinal
);

module.exports = router;
