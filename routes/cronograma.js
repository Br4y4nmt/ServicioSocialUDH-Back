const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multerConfig');
const { CronogramaActividad, TrabajoSocialSeleccionado, Estudiantes } = require('../models');
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

router.get(
  '/trabajo/:trabajo_social_id/proceso',
  authMiddleware,
  verificarRol(
    'alumno',
    'docente supervisor',
    'gestor-udh',
    'programa-academico'
  ),
  async (req, res) => {
    try {
      const { trabajo_social_id } = req.params;

      const trabajoId = Number(
        trabajo_social_id
      );

      // ==========================================
      // VALIDAR ID
      // ==========================================
      if (
        !Number.isInteger(trabajoId) ||
        trabajoId <= 0
      ) {
        return res.status(400).json({
          message:
            'ID de trabajo social inválido',
        });
      }

      // ==========================================
      // OBTENER TRABAJO SOCIAL
      // ==========================================
      const trabajo =
        await TrabajoSocialSeleccionado.findByPk(
          trabajoId,
          {
            attributes: [
              'id',
              'usuario_id',
              'tipo_servicio_social',
              'createdAt',
            ],

            include: [
              {
                model: Estudiantes,

                attributes: [
                  'nombre_estudiante',
                ],

                required: false,
              },
            ],
          }
        );

      if (!trabajo) {
        return res.status(404).json({
          message:
            'Trabajo social no encontrado',
        });
      }

      const trabajoPlain =
        trabajo.get({
          plain: true,
        });

      // ==========================================
      // OBTENER ACTIVIDADES
      // ==========================================
      const actividades =
        await CronogramaActividad.findAll({
          where: {
            trabajo_social_id:
              trabajoId,
          },

          attributes: [
            'id',
            'trabajo_social_id',
            'actividad',
            'justificacion',
            'fecha',
            'fecha_fin',
            'resultados',
            'observacion',
            'estado',
            'fecha_fin_primero',
            'fecha_observacion',
            'fecha_limite_reenvio',
            'correccion_habilitada',
            'evidencia',
            'createdAt',
            'updatedAt',
          ],

          order: [
            ['fecha', 'ASC'],
            ['id', 'ASC'],
          ],
        });

      // ==========================================
      // FECHA ACTUAL
      // ==========================================
      const ahora = new Date();

      // ==========================================
      // OBTENER YYYY-MM-DD DE CUALQUIER FECHA
      // ==========================================
      const obtenerFechaCalendario = (
        valor
      ) => {
        if (!valor) {
          return null;
        }

        // Si Sequelize devuelve string
        if (typeof valor === 'string') {
          const coincidencia =
            valor.match(
              /^(\d{4})-(\d{2})-(\d{2})/
            );

          if (coincidencia) {
            return `${coincidencia[1]}-${coincidencia[2]}-${coincidencia[3]}`;
          }
        }

        // Si Sequelize devuelve Date
        const fecha = new Date(valor);

        if (
          Number.isNaN(
            fecha.getTime()
          )
        ) {
          return null;
        }

        return fecha
          .toISOString()
          .slice(0, 10);
      };

      // ==========================================
      // SUMAR / RESTAR DÍAS SIN PROBLEMAS
      // DE ZONA HORARIA
      // ==========================================
      const sumarDiasCalendario = (
        fechaTexto,
        dias
      ) => {
        if (!fechaTexto) {
          return null;
        }

        const partes =
          fechaTexto
            .split('-')
            .map(Number);

        if (partes.length !== 3) {
          return null;
        }

        const [
          anio,
          mes,
          dia,
        ] = partes;

        const fechaUTC =
          new Date(
            Date.UTC(
              anio,
              mes - 1,
              dia + dias,
              12,
              0,
              0,
              0
            )
          );

        if (
          Number.isNaN(
            fechaUTC.getTime()
          )
        ) {
          return null;
        }

        return fechaUTC
          .toISOString()
          .slice(0, 10);
      };

      // ==========================================
      // CREAR FECHA EN HORARIO DE PERÚ
      // PERÚ = UTC-5
      //
      // Ejemplo:
      // 29/06/2026 23:59:59 Perú
      // =
      // 30/06/2026 04:59:59 UTC
      // ==========================================
      const crearFechaPeru = (
        fechaTexto,
        hora = 0,
        minuto = 0,
        segundo = 0,
        milisegundo = 0
      ) => {
        if (!fechaTexto) {
          return null;
        }

        const partes =
          fechaTexto
            .split('-')
            .map(Number);

        if (partes.length !== 3) {
          return null;
        }

        const [
          anio,
          mes,
          dia,
        ] = partes;

        // Perú está 5 horas detrás de UTC.
        const fecha =
          new Date(
            Date.UTC(
              anio,
              mes - 1,
              dia,
              hora + 5,
              minuto,
              segundo,
              milisegundo
            )
          );

        if (
          Number.isNaN(
            fecha.getTime()
          )
        ) {
          return null;
        }

        return fecha;
      };

      // ==========================================
      // PROCESAR CRONOGRAMA
      // ==========================================
      const cronograma =
        actividades.map(
          (actividad) => {
            const item =
              actividad.get({
                plain: true,
              });

            let fechaInicioPermitida =
              null;

            let fechaLimite =
              null;

            let tipoPlazo =
              'normal';

            let fechaLimiteCalendario =
              null;

            // ======================================
            // CASO 1:
            // EVIDENCIA OBSERVADA CON REENVÍO
            // ======================================
            if (
              item.estado ===
                'observado' &&
              item.correccion_habilitada ===
                true &&
              item.fecha_limite_reenvio
            ) {
              tipoPlazo =
                'reenvio';

              // El reenvío empieza desde
              // la fecha de observación.
              if (
                item.fecha_observacion
              ) {
                const inicioReenvio =
                  new Date(
                    item.fecha_observacion
                  );

                if (
                  !Number.isNaN(
                    inicioReenvio.getTime()
                  )
                ) {
                  fechaInicioPermitida =
                    inicioReenvio;
                }
              }

              // La fecha límite del reenvío
              // ya viene definida desde BD.
              const limiteReenvio =
                new Date(
                  item.fecha_limite_reenvio
                );

              if (
                !Number.isNaN(
                  limiteReenvio.getTime()
                )
              ) {
                fechaLimite =
                  limiteReenvio;
              }
            }

            // ======================================
            // CASO 2:
            // PLAZO NORMAL
            // ======================================
            else if (
              item.fecha_fin_primero
            ) {
              const fechaBaseCalendario =
                obtenerFechaCalendario(
                  item.fecha_fin_primero
                );

              if (
                fechaBaseCalendario
              ) {
                // ----------------------------------
                // Se habilita 5 días antes
                // ----------------------------------
                const inicioCalendario =
                  sumarDiasCalendario(
                    fechaBaseCalendario,
                    -5
                  );

                // ----------------------------------
                // Vence 10 días después
                // ----------------------------------
                fechaLimiteCalendario =
                  sumarDiasCalendario(
                    fechaBaseCalendario,
                    10
                  );

                // Inicio permitido:
                // 00:00:00 hora Perú
                fechaInicioPermitida =
                  crearFechaPeru(
                    inicioCalendario,
                    0,
                    0,
                    0,
                    0
                  );

                // Fecha límite:
                // 23:59:59.999 hora Perú
                fechaLimite =
                  crearFechaPeru(
                    fechaLimiteCalendario,
                    23,
                    59,
                    59,
                    999
                  );
              }
            }

            // ==========================================
            // ESTADO DEL PLAZO
            // ==========================================
            let estadoPlazo =
              'sin_fecha';

            const fechasValidas =
              fechaInicioPermitida &&
              fechaLimite &&
              !Number.isNaN(
                fechaInicioPermitida.getTime()
              ) &&
              !Number.isNaN(
                fechaLimite.getTime()
              );

            if (fechasValidas) {
              // ======================================
              // REENVÍO
              // ======================================
              if (
                tipoPlazo ===
                'reenvio'
              ) {
                /*
                  Mientras siga en estado "observado"
                  y corrección habilitada, significa
                  que todavía está pendiente el reenvío.

                  En este caso SÍ debemos evaluar
                  la fecha actual, aunque exista una
                  evidencia anterior, porque esa
                  evidencia es precisamente la que
                  fue observada.
                */

                if (
                  ahora <
                  fechaInicioPermitida
                ) {
                  estadoPlazo =
                    'aun_no_habilitado';
                } else if (
                  ahora >
                  fechaLimite
                ) {
                  estadoPlazo =
                    'vencido';
                } else {
                  estadoPlazo =
                    'a_tiempo';
                }
              }

              // ======================================
              // PLAZO NORMAL
              // ======================================
              else {
                /*
                  Si YA existe evidencia, utilizamos
                  fecha_fin porque este campo guarda
                  la fecha real en que el estudiante
                  realizó el envío.
                */
                if (item.evidencia) {
                  const fechaEnvioCalendario =
                    obtenerFechaCalendario(
                      item.fecha_fin
                    );

                  /*
                    Si existe fecha_fin, comprobamos
                    que el envío haya ocurrido hasta
                    la fecha límite.

                    Como el sistema normalmente no
                    permite enviar después del límite,
                    esto debería dar "a_tiempo".
                  */
                  if (
                    fechaEnvioCalendario &&
                    fechaLimiteCalendario
                  ) {
                    if (
                      fechaEnvioCalendario <=
                      fechaLimiteCalendario
                    ) {
                      estadoPlazo =
                        'a_tiempo';
                    } else {
                      estadoPlazo =
                        'vencido';
                    }
                  }

                  /*
                    Si existe evidencia pero por algún
                    registro antiguo fecha_fin está null,
                    asumimos que el envío fue realizado.
                  */
                  else {
                    estadoPlazo =
                      'a_tiempo';
                  }
                }

                // ==================================
                // NO EXISTE EVIDENCIA
                // ==================================
                else if (
                  ahora <
                  fechaInicioPermitida
                ) {
                  estadoPlazo =
                    'aun_no_habilitado';
                }

                else if (
                  ahora >
                  fechaLimite
                ) {
                  estadoPlazo =
                    'vencido';
                }

                else {
                  estadoPlazo =
                    'a_tiempo';
                }
              }
            }

            // ==========================================
            // ESTADO DE LA EVIDENCIA
            // ==========================================
            let estadoEvidencia =
              'no_enviado';

            if (item.evidencia) {
              switch (
                item.estado
              ) {
                case 'aprobado':
                  estadoEvidencia =
                    'aceptado';
                  break;

                case 'observado':
                  estadoEvidencia =
                    'observado';
                  break;

                case 'pendiente':
                  estadoEvidencia =
                    'pendiente';
                  break;

                default:
                  estadoEvidencia =
                    'pendiente';
                  break;
              }
            }

            // ==========================================
            // RESPUESTA DE CADA ACTIVIDAD
            // ==========================================
            return {
              id:
                item.id,

              trabajo_social_id:
                item.trabajo_social_id,

              actividad:
                item.actividad,

              justificacion:
                item.justificacion,

              fecha:
                item.fecha,

              // Fecha real en que envió evidencia
              fecha_fin:
                item.fecha_fin,

              // Fecha base del plazo
              fecha_fin_primero:
                item.fecha_fin_primero,

              resultados:
                item.resultados,

              observacion:
                item.observacion,

              evidencia:
                item.evidencia,

              estado:
                item.estado,

              correccion_habilitada:
                item.correccion_habilitada,

              fecha_observacion:
                item.fecha_observacion,

              fecha_limite_reenvio:
                item.fecha_limite_reenvio,

              createdAt:
                item.createdAt,

              updatedAt:
                item.updatedAt,

              // ======================================
              // CAMPOS CALCULADOS
              // ======================================
              tipo_plazo:
                tipoPlazo,

              fecha_inicio_permitida:
                fechaInicioPermitida &&
                !Number.isNaN(
                  fechaInicioPermitida.getTime()
                )
                  ? fechaInicioPermitida.toISOString()
                  : null,

              fecha_limite_actual:
                fechaLimite &&
                !Number.isNaN(
                  fechaLimite.getTime()
                )
                  ? fechaLimite.toISOString()
                  : null,

              estado_plazo:
                estadoPlazo,

              estado_evidencia:
                estadoEvidencia,
            };
          }
        );

      // ==========================================
      // RESPUESTA FINAL
      // ==========================================
      return res.status(200).json({
        trabajo: {
          id:
            trabajoPlain.id,

          usuario_id:
            trabajoPlain.usuario_id,

          tipo_servicio_social:
            trabajoPlain.tipo_servicio_social,

          createdAt:
            trabajoPlain.createdAt,

          estudiante: {
            nombre_estudiante:
              trabajoPlain.Estudiante
                ?.nombre_estudiante ||
              null,
          },
        },

        total_actividades:
          cronograma.length,

        actividades:
          cronograma,
      });
    } catch (error) {
      console.error(
        'Error al obtener proceso del cronograma:',
        error
      );

      return res.status(500).json({
        message:
          'Error interno al obtener el proceso del cronograma',

        error:
          error.message,
      });
    }
  }
);

module.exports = router;