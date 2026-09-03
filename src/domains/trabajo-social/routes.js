const express = require('express');
const multer = require('multer');
const authMiddleware = require('../../../middlewares/authMiddleware');
const verificarRol = require('../../../middlewares/verificarRol');

const {
  healthCheck,
  previsualizarPlanPdf,
  guardarPlanPdf,
  aceptarDesignacion,
} = require('./controller');

const router = express.Router();

const uploadAnexo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Solo se permiten archivos PDF'));
    }

    cb(null, true);
  },
});

router.get('/health', healthCheck);

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

module.exports = router;