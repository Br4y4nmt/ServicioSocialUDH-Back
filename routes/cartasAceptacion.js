const express = require('express');
const router = express.Router();

const {
  CartaAceptacion,
  IntegranteGrupo,
} = require('../models');

const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');

router.get(
  '/grupo/:trabajo_id',
  authMiddleware,
  verificarRol(
    'alumno',
    'docente supervisor',
    'gestor-udh',
    'programa-academico'
  ),
  async (req, res) => {
    try {
      const trabajoId = Number(req.params.trabajo_id);

      if (
        !Number.isInteger(trabajoId) ||
        trabajoId <= 0
      ) {
        return res.status(400).json({
          message: 'trabajo_id inválido',
        });
      }

      const [cartas, integrantes] =
        await Promise.all([
          CartaAceptacion.findAll({
            where: {
              trabajo_id: trabajoId,
            },
            attributes: [
              'nombre_archivo_pdf',
              'codigo_universitario',
            ],
          }),

          IntegranteGrupo.findAll({
            where: {
              trabajo_social_id: trabajoId,
            },
            attributes: [
              'codigo',
              'nombre_completo',
            ],
          }),
        ]);

      const nombrePorCodigo = {};

      for (const integrante of integrantes) {
        const codigo = String(
          integrante.codigo || ''
        ).trim();

        if (codigo) {
          nombrePorCodigo[codigo] =
            integrante.nombre_completo;
        }
      }

      const resultado = cartas.map(
        (carta) => ({
          nombre_archivo_pdf:
            carta.nombre_archivo_pdf,

          codigo_universitario:
            carta.codigo_universitario,

          nombre_completo:
            nombrePorCodigo[
              carta.codigo_universitario
            ] || null,
        })
      );

      return res.status(200).json(resultado);
    } catch (error) {
      console.error(
        'Error al obtener cartas del grupo:',
        error
      );

      return res.status(500).json({
        message:
          'Error al obtener cartas de aceptación del grupo',
      });
    }
  }
);

module.exports = router;