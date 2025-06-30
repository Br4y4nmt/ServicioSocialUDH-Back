const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multerConfig');
const { CronogramaActividad, TrabajoSocialSeleccionado } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const path = require('path');
const fs = require('fs');
const verificarRol = require('../middlewares/verificarRol');
// Obtener cronograma por usuario
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
router.post('/evidencia/:actividad_id',
  authMiddleware,
  verificarRol('alumno'),
  upload.single('evidencia'),
  async (req, res) => {
  const { actividad_id } = req.params;
  const { estado } = req.body;

  try {
    const actividad = await CronogramaActividad.findByPk(actividad_id, {
      include: {
        model: TrabajoSocialSeleccionado,
        as: 'trabajoSocial'
      }
    });

    if (!actividad) {
      return res.status(404).json({ message: 'Actividad no encontrada' });
    }

    // 🚫 Bloqueo si el plan aún no está aceptado por el docente
    if (!actividad.trabajoSocial || actividad.trabajoSocial.estado_plan_labor_social !== 'aceptado') {
      return res.status(403).json({
        message: 'No puedes subir evidencias porque tu plan aún no ha sido aceptado por el docente.'
      });
    }

    // 🚫 Bloqueo si ya fue enviada o aprobada la carta de término
    if (
      actividad.trabajoSocial.estado_carta === 'solicitada' ||
      actividad.trabajoSocial.estado_carta === 'aprobada'
    ) {
      return res.status(403).json({
        message: 'No puedes subir evidencias porque tu carta de término ya fue solicitada o aprobada.'
      });
    }

    // 🚫 Ya existe evidencia para esta actividad
    if (actividad.evidencia) {
      return res.status(400).json({ message: 'Ya existe una evidencia para esta actividad.' });
    }

    // ✅ Validación de rango de fecha
    const fechaActual = new Date();
    const fechaPermitida = new Date(actividad.fecha_fin_primero);
    const fechaMinima = new Date(fechaPermitida);
    fechaMinima.setDate(fechaPermitida.getDate() - 5);
    const fechaMaxima = new Date(fechaPermitida);
    fechaMaxima.setDate(fechaPermitida.getDate() + 10);

    if (fechaActual < fechaMinima || fechaActual > fechaMaxima) {
      return res.status(400).json({
        message: 'La fecha actual no está dentro del rango permitido para subir evidencia.',
        detalles: {
          permitidoDesde: fechaMinima.toISOString().split('T')[0],
          permitidoHasta: fechaMaxima.toISOString().split('T')[0],
          hoy: fechaActual.toISOString().split('T')[0]
        }
      });
    }

    // ✅ Guardado de evidencia
    actividad.fecha_fin = fechaActual.toISOString().split('T')[0]; // fecha del servidor
    if (estado) actividad.estado = estado;
    actividad.evidencia = req.file.filename;

    await actividad.save();

    res.json({
      message: 'Evidencia y datos guardados con éxito',
      filename: actividad.evidencia,
      fecha_fin: actividad.fecha_fin,
      estado: actividad.estado
    });

  } catch (error) {
    console.error('Error al subir evidencia:', error);
    res.status(500).json({ message: 'Error al subir evidencia' });
  }
});



// Obtener cronograma por ID de trabajo social
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

// Guardar cronograma completo
router.post('/:usuario_id',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
  const { usuario_id } = req.params;
  const { actividades } = req.body;

  try {
    const trabajo = await TrabajoSocialSeleccionado.findOne({ where: { usuario_id } });
    if (!trabajo) return res.status(404).json({ message: 'Trabajo no encontrado' });

    // Eliminar anteriores
    await CronogramaActividad.destroy({ where: { trabajo_social_id: trabajo.id } });

    // Insertar nuevos
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
router.patch('/:id/estado',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    const actividad = await CronogramaActividad.findByPk(id);
    if (!actividad) {
      return res.status(404).json({ message: 'Actividad no encontrada' });
    }

    actividad.estado = estado;
    await actividad.save();

    res.json({ message: 'Estado actualizado correctamente', estado: actividad.estado });
  } catch (error) {
    console.error('Error al actualizar estado de la actividad:', error);
    res.status(500).json({ message: 'Error al actualizar estado' });
  }
});
router.get('/trabajo/:trabajo_social_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  const { trabajo_social_id } = req.params;

  try {
    const actividades = await CronogramaActividad.findAll({
      where: { trabajo_social_id }
    });

    res.json(actividades); // actividades incluirá 'estado' y 'observacion'
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

      // Verificamos si hay evidencia previa
      if (actividad.evidencia) {
        const rutaArchivo = path.join(__dirname, '..', 'uploads', 'evidencias', actividad.evidencia);
        if (fs.existsSync(rutaArchivo)) {
          fs.unlinkSync(rutaArchivo); // Elimina del sistema de archivos
        }
        // Limpiar campos de evidencia en la base de datos
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
router.patch('/:id/observacion',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  const { id } = req.params;
  const { observacion } = req.body;

  try {
    const actividad = await CronogramaActividad.findByPk(id);
    if (!actividad) {
      return res.status(404).json({ message: 'Actividad no encontrada' });
    }

    actividad.estado = 'observado'; // También marcamos como observado
    actividad.observacion = observacion;
    await actividad.save();

    res.json({ message: 'Observación registrada exitosamente', observacion: actividad.observacion });
  } catch (error) {
    console.error('Error al guardar observación:', error);
    res.status(500).json({ message: 'Error al guardar observación' });
  }
});

module.exports = router;
