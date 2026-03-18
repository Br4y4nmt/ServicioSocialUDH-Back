const express = require('express');
const router = express.Router();
const { IntegranteGrupo, TrabajoSocialSeleccionado, Usuario} = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');



router.post('/',
  authMiddleware,
  verificarRol('alumno', 'gestor-udh'),
  async (req, res) => {
    try {
      const { trabajo_social_id, correos } = req.body;

      if (!trabajo_social_id || !Array.isArray(correos)) {
        return res.status(400).json({ message: 'Faltan datos requeridos' });
      }

      const correosNorm = correos
        .map(c => String(c || '').trim().toLowerCase())
        .filter(Boolean);

      if (correosNorm.length === 0) {
        return res.status(400).json({ message: 'No se enviaron correos válidos' });
      }

      const invalidos = correosNorm.filter(c => !c.endsWith('@udh.edu.pe'));
      if (invalidos.length) {
        return res.status(400).json({
          message: 'Hay correos con dominio inválido (solo @udh.edu.pe)',
          invalidos,
        });
      }

      const seen = new Set();
      const duplicadosReq = new Set();
      for (const c of correosNorm) {
        if (seen.has(c)) duplicadosReq.add(c);
        else seen.add(c);
      }
      if (duplicadosReq.size > 0) {
        return res.status(409).json({
          message: 'Hay correos repetidos en el envío',
          duplicados: [...duplicadosReq],
        });
      }

      const existentes = await IntegranteGrupo.findAll({
        where: {
          trabajo_social_id,
          correo_institucional: correosNorm,
        },
        attributes: ['correo_institucional'],
      });

      if (existentes.length > 0) {
        return res.status(409).json({
          message: 'Algunos correos ya están registrados en este trabajo social',
          duplicados: existentes.map(e => e.correo_institucional),
        });
      }

      const registros = await IntegranteGrupo.bulkCreate(
        correosNorm.map(correo => ({
          trabajo_social_id,
          correo_institucional: correo
        })),
        { validate: true }
      );

      return res.status(201).json({ message: 'Integrantes registrados', registros });

    } catch (error) {
      console.error('Error al registrar integrantes:', error);
      return res.status(500).json({ message: 'Error del servidor' });
    }
  }
);


router.get(
  '/:trabajo_social_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh'),
  async (req, res) => {
    try {
      const { trabajo_social_id } = req.params;
      const idTrabajo = Number(trabajo_social_id);

      if (!Number.isInteger(idTrabajo) || idTrabajo <= 0) {
        return res.status(400).json({ message: 'ID de trabajo social inválido' });
      }

      const integrantes = await IntegranteGrupo.findAll({
        where: { trabajo_social_id: idTrabajo },
        attributes: [
          'id_integrante',
          'trabajo_social_id',
          ['correo_institucional', 'correo'],
          ['nombre_completo', 'nombre'],
          'codigo',
          'dni',
          'facultad',
          'programa_academico',
          'estado'
        ],
        order: [['id_integrante', 'ASC']]
      });

      if (!integrantes.length) {
        return res.status(404).json({ message: 'No hay integrantes registrados' });
      }

      return res.status(200).json(integrantes);
    } catch (error) {
      console.error('Error al obtener integrantes:', error);
      return res.status(500).json({ message: 'Error del servidor' });
    }
  }
);


router.get(
  '/estudiante/actual',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh'),
  async (req, res) => {
    try {
      const { usuario_id } = req.query;

      if (!usuario_id) {
        return res.status(400).json({ message: 'Falta el ID del usuario' });
      }

      const trabajo = await TrabajoSocialSeleccionado.findOne({
        where: { usuario_id },
      });

      if (!trabajo) {
        return res.status(200).json({
          integrantes: [],
          message: 'Aún no tienes una solicitud registrada.',
        });
      }

      const integrantes = await IntegranteGrupo.findAll({
        where: { trabajo_social_id: trabajo.id },
        attributes: [
          'id_integrante',
          'nombre_completo',
          'codigo',
          'dni',
          'facultad',
          'programa_academico',
          'correo_institucional',
          'estado'
        ],
      });

      return res.status(200).json({
        integrantes,
        message:
          integrantes.length === 0
            ? 'Aún no tienes integrantes registrados.'
            : null,
      });
    } catch (error) {
      console.error('Error al obtener integrantes del estudiante:', error);
      return res.status(500).json({ message: 'Error del servidor' });
    }
  }
);

module.exports = router;
