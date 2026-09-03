const express = require('express');
const router = express.Router();
const { IntegranteGrupo, TrabajoSocialSeleccionado, Usuario} = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const { Op } = require('sequelize');
const { getDatosAcademicosUDH } = require('../services/udhservicenuevo');



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


router.post(
  '/gestor/agregar-por-codigo',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
    try {
      const { trabajo_social_id, codigo } = req.body;

      const idTrabajo = Number(trabajo_social_id);
      const codigoLimpio = String(codigo || '').trim();

      if (!Number.isInteger(idTrabajo) || idTrabajo <= 0) {
        return res.status(400).json({
          message: 'ID de trabajo social inválido'
        });
      }

      if (!codigoLimpio || !/^\d+$/.test(codigoLimpio)) {
        return res.status(400).json({
          message: 'Código universitario inválido'
        });
      }

      const trabajo = await TrabajoSocialSeleccionado.findByPk(idTrabajo);

      if (!trabajo) {
        return res.status(404).json({
          message: 'Trabajo social no encontrado'
        });
      }

      const estadoInforme = String(
        trabajo.estado_informe_final || ''
      )
        .trim()
        .toLowerCase();

      if (estadoInforme !== 'pendiente') {
        return res.status(409).json({
          message:
            'No se pueden agregar integrantes porque el informe final ya no se encuentra pendiente'
        });
      }

      if (!trabajo.usuario_id) {
        return res.status(422).json({
          message:
            'El trabajo social no tiene un estudiante principal asociado'
        });
      }

      const usuarioPrincipal = await Usuario.findByPk(
        trabajo.usuario_id,
        {
          attributes: ['id_usuario', 'email']
        }
      );

      if (!usuarioPrincipal) {
        return res.status(404).json({
          message:
            'No se encontró al usuario principal del trabajo social'
        });
      }

      const correoPrincipal = String(
        usuarioPrincipal.email || ''
      )
        .trim()
        .toLowerCase();

      const codigoPrincipal = correoPrincipal.includes('@')
        ? correoPrincipal.split('@')[0]
        : '';

      if (!codigoPrincipal) {
        return res.status(422).json({
          message:
            'No se pudo determinar el código universitario del estudiante principal'
        });
      }

      if (codigoLimpio === codigoPrincipal) {
        return res.status(409).json({
          message:
            'El estudiante principal no puede ser agregado como integrante de su propio grupo'
        });
      }

      const datos = await getDatosAcademicosUDH(codigoLimpio);

      if (!datos) {
        return res.status(404).json({
          message:
            'No se encontró un estudiante con el código ingresado'
        });
      }

      const codigoEstudiante = String(
        datos.codigo || codigoLimpio
      ).trim();

      const correoInstitucional = String(
        datos.email || `${codigoEstudiante}@udh.edu.pe`
      )
        .trim()
        .toLowerCase();

      if (codigoEstudiante === codigoPrincipal) {
        return res.status(409).json({
          message:
            'El estudiante principal no puede ser agregado como integrante de su propio grupo'
        });
      }

      // Ya no se valida el ciclo académico del estudiante.

      const existente = await IntegranteGrupo.findOne({
        where: {
          trabajo_social_id: idTrabajo,
          [Op.or]: [
            {
              codigo: codigoEstudiante
            },
            {
              correo_institucional: correoInstitucional
            }
          ]
        }
      });

      if (existente) {
        return res.status(409).json({
          message: 'El estudiante ya pertenece a este grupo'
        });
      }

      const integrante = await IntegranteGrupo.create({
        trabajo_social_id: idTrabajo,
        correo_institucional: correoInstitucional,
        nombre_completo: datos.nombre_completo,
        codigo: codigoEstudiante,
        dni: datos.dni,
        facultad: datos.facultad,
        programa_academico: datos.programa
      });

      return res.status(201).json({
        message: 'Integrante agregado correctamente',
        integrante: {
          id_integrante: integrante.id_integrante,
          trabajo_social_id: integrante.trabajo_social_id,
          nombre_completo: integrante.nombre_completo,
          codigo: integrante.codigo,
          dni: integrante.dni,
          facultad: integrante.facultad,
          programa_academico: integrante.programa_academico,
          correo_institucional: integrante.correo_institucional,
          estado: integrante.estado
        }
      });
    } catch (error) {
      console.error(
        'Error al agregar integrante por código:',
        error
      );

      return res.status(500).json({
        message: 'Error interno al agregar integrante',
        error: error.message
      });
    }
  }
);
module.exports = router;
