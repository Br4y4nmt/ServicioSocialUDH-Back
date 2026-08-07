const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multerConfig');
const { CronogramaActividad, TrabajoSocialSeleccionado } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const path = require('path');
const fs = require('fs');
const verificarRol = require('../middlewares/verificarRol');

router.get('/:usuario_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const trabajo = await TrabajoSocialSeleccionado.findOne({ where: { usuario_id } });
    if (!trabajo) return res.status(404).json({ message: 'No encontrado' });

    const actividades = await CronogramaActividad.findAll({
      where: { trabajo_social_id: trabajo.id }
    });

    res.json(actividades);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cronograma' });
  }
});

router.post(
  '/evidencia/:actividad_id',
  authMiddleware,
  verificarRol('alumno'),
  upload.single('evidencia'),
  async (req, res) => {
    const { actividad_id } = req.params;
    const { estado } = req.body;

    try {
      const actividad = await CronogramaActividad.findByPk(
        actividad_id,
        {
          include: {
            model: TrabajoSocialSeleccionado,
            as: 'trabajoSocial'
          }
        }
      );

      if (!actividad) {
        return res.status(404).json({
          message: 'Actividad no encontrada'
        });
      }

      if (
        !actividad.trabajoSocial ||
        actividad.trabajoSocial.estado_plan_labor_social !== 'aceptado'
      ) {
        return res.status(403).json({
          message:
            'No puedes subir evidencias porque tu plan aún no ha sido aceptado por el docente.'
        });
      }

      if (
        actividad.trabajoSocial.estado_carta === 'solicitada' ||
        actividad.trabajoSocial.estado_carta === 'aprobada'
      ) {
        return res.status(403).json({
          message:
            'No puedes subir evidencias porque tu carta de término ya fue solicitada o aprobada.'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: 'Debes seleccionar una evidencia.'
        });
      }

      const fechaActual = new Date();

      const esReenvioObservado =
        actividad.estado === 'observado' &&
        actividad.correccion_habilitada === true &&
        actividad.fecha_limite_reenvio;

      if (esReenvioObservado) {

        const fechaLimiteReenvio = new Date(
          actividad.fecha_limite_reenvio
        );

        if (fechaActual > fechaLimiteReenvio) {

          const rutaArchivoNuevo = path.join(
            __dirname,
            '..',
            'uploads',
            'evidencias',
            req.file.filename
          );

          try {
            if (fs.existsSync(rutaArchivoNuevo)) {
              fs.unlinkSync(rutaArchivoNuevo);
            }
          } catch (errorArchivo) {
            console.error(
              'Error eliminando archivo fuera de plazo:',
              errorArchivo
            );
          }

          return res.status(400).json({
            message:
              'El plazo adicional para corregir la evidencia ha finalizado.',
            detalles: {
              fecha_observacion:
                actividad.fecha_observacion,

              permitido_hasta:
                actividad.fecha_limite_reenvio
            }
          });
        }

        const evidenciaAnterior =
          actividad.evidencia;

        actividad.evidencia =
          req.file.filename;

        actividad.estado =
          'pendiente';

        actividad.correccion_habilitada =
          false;

        actividad.fecha_fin =
          fechaActual.toISOString().split('T')[0];

        await actividad.save();

        if (evidenciaAnterior) {

          const rutaAnterior = path.join(
            __dirname,
            '..',
            'uploads',
            'evidencias',
            evidenciaAnterior
          );

          try {

            if (fs.existsSync(rutaAnterior)) {
              fs.unlinkSync(rutaAnterior);
            }

          } catch (errorArchivo) {

            console.error(
              'No se pudo eliminar la evidencia anterior:',
              errorArchivo
            );
          }
        }

        return res.json({
          message:
            'Evidencia corregida enviada correctamente. Será revisada nuevamente por el docente.',

          filename:
            actividad.evidencia,

          fecha_fin:
            actividad.fecha_fin,

          estado:
            actividad.estado,

          correccion_habilitada:
            actividad.correccion_habilitada,

          fecha_observacion:
            actividad.fecha_observacion,

          fecha_limite_reenvio:
            actividad.fecha_limite_reenvio
        });
      }

      if (
        actividad.estado === 'observado' &&
        !actividad.correccion_habilitada
      ) {

        const rutaArchivoNuevo = path.join(
          __dirname,
          '..',
          'uploads',
          'evidencias',
          req.file.filename
        );

        try {

          if (fs.existsSync(rutaArchivoNuevo)) {
            fs.unlinkSync(rutaArchivoNuevo);
          }

        } catch (errorArchivo) {

          console.error(
            'Error eliminando archivo sin corrección habilitada:',
            errorArchivo
          );
        }

        return res.status(403).json({
          message:
            'Primero debes habilitar la corrección de la evidencia observada.'
        });
      }

      if (actividad.evidencia) {

        const rutaArchivoNuevo = path.join(
          __dirname,
          '..',
          'uploads',
          'evidencias',
          req.file.filename
        );

        try {

          if (fs.existsSync(rutaArchivoNuevo)) {
            fs.unlinkSync(rutaArchivoNuevo);
          }

        } catch (errorArchivo) {

          console.error(
            'Error eliminando evidencia duplicada:',
            errorArchivo
          );
        }

        return res.status(400).json({
          message:
            'Ya existe una evidencia para esta actividad.'
        });
      }

      if (!actividad.fecha_fin_primero) {

        const rutaArchivoNuevo = path.join(
          __dirname,
          '..',
          'uploads',
          'evidencias',
          req.file.filename
        );

        try {

          if (fs.existsSync(rutaArchivoNuevo)) {
            fs.unlinkSync(rutaArchivoNuevo);
          }

        } catch (errorArchivo) {

          console.error(
            'Error eliminando archivo sin fecha:',
            errorArchivo
          );
        }

        return res.status(400).json({
          message:
            'La actividad no tiene una fecha configurada para subir evidencia.'
        });
      }

      const fechaPermitida = new Date(
        actividad.fecha_fin_primero
      );

      const fechaMinima =
        new Date(fechaPermitida);

      fechaMinima.setDate(
        fechaMinima.getDate() - 5
      );

      const fechaMaxima =
        new Date(fechaPermitida);

      fechaMaxima.setDate(
        fechaMaxima.getDate() + 10
      );

      if (
        fechaActual < fechaMinima ||
        fechaActual > fechaMaxima
      ) {

        const rutaArchivoNuevo = path.join(
          __dirname,
          '..',
          'uploads',
          'evidencias',
          req.file.filename
        );

        try {

          if (fs.existsSync(rutaArchivoNuevo)) {
            fs.unlinkSync(rutaArchivoNuevo);
          }

        } catch (errorArchivo) {

          console.error(
            'Error eliminando archivo fuera de fecha:',
            errorArchivo
          );
        }

        return res.status(400).json({
          message:
            'La fecha actual no está dentro del rango permitido para subir evidencia.',

          detalles: {
            permitidoDesde:
              fechaMinima
                .toISOString()
                .split('T')[0],

            permitidoHasta:
              fechaMaxima
                .toISOString()
                .split('T')[0],

            hoy:
              fechaActual
                .toISOString()
                .split('T')[0]
          }
        });
      }

      actividad.fecha_fin =
        fechaActual
          .toISOString()
          .split('T')[0];

      if (estado) {
        actividad.estado = estado;
      } else {
        actividad.estado = 'pendiente';
      }

      actividad.evidencia =
        req.file.filename;
      actividad.correccion_habilitada =
        false;

      await actividad.save();

      return res.json({
        message:
          'Evidencia y datos guardados con éxito',

        filename:
          actividad.evidencia,

        fecha_fin:
          actividad.fecha_fin,

        estado:
          actividad.estado,

        correccion_habilitada:
          actividad.correccion_habilitada
      });

    } catch (error) {

      console.error(
        'Error al subir evidencia:',
        error
      );

      if (
        req.file &&
        req.file.filename
      ) {

        const rutaArchivoNuevo = path.join(
          __dirname,
          '..',
          'uploads',
          'evidencias',
          req.file.filename
        );

        try {

          if (fs.existsSync(rutaArchivoNuevo)) {
            fs.unlinkSync(rutaArchivoNuevo);
          }

        } catch (errorArchivo) {

          console.error(
            'Error eliminando archivo después del fallo:',
            errorArchivo
          );
        }
      }

      return res.status(500).json({
        message:
          'Error al subir evidencia'
      });
    }
  }
);

router.get('/trabajo/:trabajo_social_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  const { trabajo_social_id } = req.params;

  try {
    const actividades = await CronogramaActividad.findAll({
      where: { trabajo_social_id }
    });

    res.json(actividades);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el cronograma por trabajo_social_id' });
  }
});

router.post('/:usuario_id',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
  const { usuario_id } = req.params;
  const { actividades } = req.body;

  try {
    const trabajo = await TrabajoSocialSeleccionado.findOne({ where: { usuario_id } });
    if (!trabajo) return res.status(404).json({ message: 'Trabajo no encontrado' });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const esPasada = (value) => {
      if (!value) return true;
      const parts = String(value).split('-').map(Number);
      if (parts.length !== 3 || parts.some(Number.isNaN)) return true;
      const [year, month, day] = parts;
      const date = new Date(year, month - 1, day);
      date.setHours(0, 0, 0, 0);
      return date < hoy;
    };

    const hayFechasPasadas = Array.isArray(actividades) && actividades.some(
      (a) => esPasada(a?.fecha) || esPasada(a?.fechaFin)
    );

    if (hayFechasPasadas) {
      return res.status(400).json({
        message: 'Hay actividades con fechas anteriores a hoy.'
      });
    }

    await CronogramaActividad.destroy({ where: { trabajo_social_id: trabajo.id } });

    const nuevas = actividades.map((a) => ({
      trabajo_social_id: trabajo.id,
      actividad: a.actividad,
      justificacion: a.justificacion,
      fecha: a.fecha,
      fecha_fin_primero: a.fechaFin,
      resultados: a.resultados
    }));

    const creadas = await CronogramaActividad.bulkCreate(nuevas);

    res.status(201).json(creadas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al guardar cronograma', error });
  }
});


router.patch(
  '/:id/estado',
  authMiddleware,
  verificarRol(
    'docente supervisor',
    'gestor-udh',
    'programa-academico'
  ),
  async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    try {
      const actividad = await CronogramaActividad.findByPk(id);

      if (!actividad) {
        return res.status(404).json({
          message: 'Actividad no encontrada'
        });
      }

      const estadosPermitidos = [
        'aprobado',
        'observado',
        'pendiente'
      ];

      if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({
          message: 'Estado inválido'
        });
      }

      actividad.estado = estado;

      if (estado === 'aprobado') {
        actividad.correccion_habilitada = false;
      }
      await actividad.save();
      return res.json({
        message: 'Estado actualizado correctamente',
        estado: actividad.estado,
        correccion_habilitada:
          actividad.correccion_habilitada
      });

    } catch (error) {
      console.error(
        'Error al actualizar estado de la actividad:',
        error
      );

      return res.status(500).json({
        message: 'Error al actualizar estado'
      });
    }
  }
);


router.get('/trabajo/:trabajo_social_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  const { trabajo_social_id } = req.params;

  try {
    const actividades = await CronogramaActividad.findAll({
      where: { trabajo_social_id }
    });

    res.json(actividades); 
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cronograma' });
  }
});


router.delete('/evidencia/:actividad_id',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
    const { actividad_id } = req.params;

    try {
      const actividad = await CronogramaActividad.findByPk(actividad_id);
      if (!actividad) {
        return res.status(404).json({ message: 'Actividad no encontrada' });
      }

      if (actividad.evidencia) {
        const rutaArchivo = path.join(__dirname, '..', 'uploads', 'evidencias', actividad.evidencia);
        if (fs.existsSync(rutaArchivo)) {
          fs.unlinkSync(rutaArchivo); 
        }
        actividad.evidencia = null;
        actividad.fecha_fin = null;
        actividad.estado = null;
        await actividad.save();
      }

      res.json({ message: 'Evidencia eliminada correctamente' });
    } catch (error) {
      console.error('Error al eliminar evidencia:', error);
      res.status(500).json({ message: 'Error al eliminar evidencia' });
    }
  }
);


router.patch(
  '/:id/observacion',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
    const { id } = req.params;
    const { observacion } = req.body;

    try {
      const actividad = await CronogramaActividad.findByPk(id);

      if (!actividad) {
        return res.status(404).json({
          message: 'Actividad no encontrada'
        });
      }

      // Fecha en que el docente realiza la observación
      const fechaObservacion = new Date();

      // Dar 2 días adicionales para corregir
      const fechaLimiteReenvio = new Date(fechaObservacion);
      fechaLimiteReenvio.setDate(
        fechaLimiteReenvio.getDate() + 2
      );

      // Actualizar actividad
      actividad.estado = 'observado';
      actividad.observacion = observacion;

      actividad.fecha_observacion = fechaObservacion;
      actividad.fecha_limite_reenvio = fechaLimiteReenvio;

      // IMPORTANTE:
      // El alumno todavía no ha pulsado "Corregir evidencia"
      actividad.correccion_habilitada = false;

      await actividad.save();

      return res.json({
        message: 'Observación registrada exitosamente',

        observacion: actividad.observacion,

        estado: actividad.estado,

        fecha_observacion:
          actividad.fecha_observacion,

        fecha_limite_reenvio:
          actividad.fecha_limite_reenvio,

        correccion_habilitada:
          actividad.correccion_habilitada
      });

    } catch (error) {
      console.error(
        'Error al guardar observación:',
        error
      );

      return res.status(500).json({
        message: 'Error al guardar observación'
      });
    }
  }
);

router.patch(
  '/:id/habilitar-correccion',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
    const { id } = req.params;

    try {
      const actividad = await CronogramaActividad.findByPk(id);

      if (!actividad) {
        return res.status(404).json({
          message: 'Actividad no encontrada'
        });
      }

      if (actividad.estado !== 'observado') {
        return res.status(400).json({
          message: 'La actividad no está observada'
        });
      }

      if (!actividad.fecha_limite_reenvio) {
        return res.status(400).json({
          message: 'No existe un plazo de corrección'
        });
      }

      const ahora = new Date();
      const fechaLimite = new Date(
        actividad.fecha_limite_reenvio
      );

      if (ahora > fechaLimite) {
        return res.status(403).json({
          message: 'El plazo de corrección ha finalizado'
        });
      }

      actividad.correccion_habilitada = true;

      await actividad.save();

      return res.json({
        message: 'Corrección habilitada correctamente',
        correccion_habilitada: true
      });

    } catch (error) {
      console.error(
        'Error habilitando corrección:',
        error
      );

      return res.status(500).json({
        message: 'Error al habilitar la corrección'
      });
    }
  }
);

module.exports = router;
