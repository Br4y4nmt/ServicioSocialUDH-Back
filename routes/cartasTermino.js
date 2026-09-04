const express = require('express');

const {
  CartaTermino,
  IntegranteGrupo
} = require('../models');

const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');

const router = express.Router();

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
    const { trabajo_id } = req.params;

    try {
      const idTrabajo = Number(trabajo_id);

      if (
        !Number.isInteger(idTrabajo) ||
        idTrabajo <= 0
      ) {
        return res.status(400).json({
          message: 'trabajo_id inválido'
        });
      }

      const [
        cartas,
        integrantes
      ] = await Promise.all([
        CartaTermino.findAll({
          where: {
            trabajo_id: idTrabajo
          },
          attributes: [
            'nombre_archivo_pdf',
            'codigo_universitario'
          ]
        }),

        IntegranteGrupo.findAll({
          where: {
            trabajo_social_id: idTrabajo
          },
          attributes: [
            'correo_institucional',
            'nombre_completo'
          ]
        })
      ]);

      const nombrePorCodigo = {};

      for (
        const integrante
        of integrantes
      ) {
        const codigo = String(
          integrante.correo_institucional || ''
        )
          .split('@')[0]
          ?.trim();

        if (codigo) {
          nombrePorCodigo[codigo] =
            integrante.nombre_completo ||
            null;
        }
      }

      const resultado =
        cartas.map((carta) => {
          const codigo = String(
            carta.codigo_universitario || ''
          ).trim();

          return {
            nombre_archivo_pdf:
              carta.nombre_archivo_pdf,

            codigo_universitario:
              codigo,

            nombre_completo:
              nombrePorCodigo[codigo] ||
              null
          };
        });

      return res
        .status(200)
        .json(resultado);
    } catch (error) {
      console.error(
        'Error al obtener cartas del grupo:',
        error
      );

      return res.status(500).json({
        message:
          'Error del servidor'
      });
    }
  }
);

module.exports = router;