const fs = require('fs/promises');
const path = require('path');
const sequelize = require('../../../config/database');

const TrabajoSocialSeleccionado = require('../../../models/TrabajoSocialSeleccionado');
const CronogramaActividad = require('../../../models/CronogramaActividad');
const Estudiantes = require('../../../models/Estudiantes');
const Facultades = require('../../../models/Facultades');
const ProgramasAcademicos = require('../../../models/ProgramasAcademicos');
const LaboresSociales = require('../../../models/LaboresSociales');
const LineaDeAccion = require('../../../models/LineaDeAccion');
const SystemConfig = require('../../../models/SystemConfig');
const Docentes = require('../../../models/Docentes');
const IntegranteGrupo = require('../../../models/IntegranteGrupo');
const CartaAceptacion = require('../../../models/CartaAceptacion');
const CartaTermino = require('../../../models/CartaTermino');
const CertificadoFinalMiembro = require('../../../models/CertificadoFinalMiembro');

const {
  generarPlanServicioSocialPdf,
} = require('./services/planPdf.service');

const {
  generarCartaAceptacionPdf,
} = require('./services/cartaAceptacionPdf.service');

const {
  generarCartaTerminoPdf,
} = require('./services/cartaTerminoPdf.service');

const {
  generarCertificadoFinalPdf,
} = require('./services/certificadoFinalPdf.service');

const healthCheck = (req, res) => {
  return res.status(200).json({
    ok: true,
    message: 'Dominio trabajo-social funcionando correctamente',
  });
};

const crearError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const limpiarTexto = (value) => {
  return String(value ?? '').trim();
};

const obtenerBaseUrl = (req) => {
  const protocolo =
    req.headers['x-forwarded-proto']?.split(',')[0]?.trim() ||
    req.protocol;

  return `${protocolo}://${req.get('host')}`;
};

const eliminarArchivoSiExiste = async (rutaArchivo) => {
  try {
    await fs.unlink(rutaArchivo);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(
        'Error al eliminar archivo:',
        rutaArchivo,
        error
      );
    }
  }
};

const parseFecha = (value) => {
  const partes = limpiarTexto(value).split('-').map(Number);

  if (
    partes.length !== 3 ||
    partes.some((parte) => Number.isNaN(parte))
  ) {
    return null;
  }

  const [anio, mes, dia] = partes;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return fecha;
};

const obtenerHoy = () => {
  const ahora = new Date();

  return new Date(
    Date.UTC(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate()
    )
  );
};

const obtenerActividades = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const actividades = JSON.parse(value);

    if (!Array.isArray(actividades)) {
      throw new Error();
    }

    return actividades;
  } catch {
    throw crearError(
      400,
      'El formato de las actividades no es válido'
    );
  }
};

const validarAnexoPdf = (file) => {
  if (!file?.buffer?.length) {
    throw crearError(
      400,
      'Debes adjuntar el Convenio de Cooperación Institucional'
    );
  }

  const encabezado = file.buffer
    .subarray(0, 5)
    .toString('ascii');

  if (encabezado !== '%PDF-') {
    throw crearError(
      400,
      'El archivo anexo debe ser un PDF válido'
    );
  }

  return file.buffer;
};

const validarCamposPlan = (data) => {
  const campos = [
    'nombreInstitucion',
    'nombreResponsable',
    'fechaPresentacion',
    'periodoEstimado',
    'introduccion',
    'justificacion',
    'objetivoGeneral',
    'objetivosEspecificos',
    'nombreEntidad',
    'misionVision',
    'areasIntervencion',
    'ubicacionPoblacion',
    'areaInfluencia',
    'metodologiaIntervencion',
    'recursosRequeridos',
    'resultadosEsperados',
  ];

  const faltantes = campos.filter(
    (campo) => !limpiarTexto(data[campo])
  );

  if (faltantes.length > 0) {
    throw crearError(
      400,
      `Completa todos los campos requeridos del plan: ${faltantes.join(', ')}`
    );
  }
};

const validarActividades = (
  actividades,
  periodoEstimado
) => {
  if (!Array.isArray(actividades) || actividades.length === 0) {
    throw crearError(
      400,
      'Debes agregar al menos una actividad al cronograma'
    );
  }

  const hoy = obtenerHoy();

  const normalizadas = actividades.map(
    (actividad, index) => {
      const item = {
        actividad: limpiarTexto(actividad?.actividad),
        justificacion: limpiarTexto(
          actividad?.justificacion
        ),
        fecha: limpiarTexto(actividad?.fecha),
        fechaFin: limpiarTexto(
          actividad?.fechaFin ??
          actividad?.fecha_fin_primero ??
          actividad?.fecha_fin
        ),
        resultados: limpiarTexto(
          actividad?.resultados
        ),
      };

      if (
        !item.actividad ||
        !item.justificacion ||
        !item.fecha ||
        !item.fechaFin ||
        !item.resultados
      ) {
        throw crearError(
          400,
          `La actividad ${index + 1} tiene datos incompletos`
        );
      }

      const fechaInicio = parseFecha(item.fecha);
      const fechaFin = parseFecha(item.fechaFin);

      if (!fechaInicio || !fechaFin) {
        throw crearError(
          400,
          `La actividad ${index + 1} contiene fechas inválidas`
        );
      }

      if (fechaInicio < hoy || fechaFin < hoy) {
        throw crearError(
          400,
          `La actividad ${index + 1} contiene fechas anteriores a hoy`
        );
      }

      if (fechaFin < fechaInicio) {
        throw crearError(
          400,
          `La fecha fin de la actividad ${index + 1} no puede ser anterior a la fecha de inicio`
        );
      }

      return item;
    }
  );

  const periodos = {
    '4 MESES': 120,
    '5 MESES': 150,
    '6 MESES': 180,
  };

  const periodo = limpiarTexto(
    periodoEstimado
  ).toUpperCase();

  const diasRequeridos = periodos[periodo];

  if (!diasRequeridos) {
    throw crearError(
      400,
      'El periodo estimado seleccionado no es válido'
    );
  }

  const milisegundosDia = 1000 * 60 * 60 * 24;

  const totalDias = normalizadas.reduce(
    (total, actividad) => {
      const fechaInicio = parseFecha(
        actividad.fecha
      );

      const fechaFin = parseFecha(
        actividad.fechaFin
      );

      const diferencia =
        (fechaFin - fechaInicio) /
        milisegundosDia;

      return total + Math.max(diferencia, 0);
    },
    0
  );

  if (totalDias < diasRequeridos) {
    throw crearError(
      400,
      `La suma total de las actividades es de ${Math.floor(totalDias)} días, pero el periodo estimado requiere ${diasRequeridos} días`
    );
  }

  const ordenadas = [...normalizadas].sort(
    (a, b) =>
      parseFecha(a.fecha) -
      parseFecha(b.fecha)
  );

  for (let i = 1; i < ordenadas.length; i++) {
    const anteriorFin = parseFecha(
      ordenadas[i - 1].fechaFin
    );

    const actualInicio = parseFecha(
      ordenadas[i].fecha
    );

    if (actualInicio < anteriorFin) {
      throw crearError(
        400,
        `La actividad "${ordenadas[i].actividad}" comienza antes de que termine la actividad anterior`
      );
    }
  }

  return normalizadas;
};

const obtenerDatosPlan = async (
  usuarioId,
  body
) => {
  const trabajo =
    await TrabajoSocialSeleccionado.findOne({
      where: {
        usuario_id: usuarioId,
      },
    });

  if (!trabajo) {
    throw crearError(
      404,
      'No se encontró un trabajo social para el usuario'
    );
  }

  const [
    estudiante,
    facultad,
    programa,
    laborSocial,
    lineaAccion,
  ] = await Promise.all([
    Estudiantes.findOne({
      where: {
        id_usuario: usuarioId,
      },
    }),
    Facultades.findByPk(
      trabajo.facultad_id
    ),
    ProgramasAcademicos.findByPk(
      trabajo.programa_academico_id
    ),
    LaboresSociales.findByPk(
      trabajo.labor_social_id
    ),
    LineaDeAccion.findByPk(
      trabajo.linea_accion_id
    ),
  ]);

  if (!estudiante) {
    throw crearError(
      404,
      'No se encontraron los datos del estudiante'
    );
  }

  if (!facultad) {
    throw crearError(
      404,
      'No se encontró la facultad del estudiante'
    );
  }

  if (!programa) {
    throw crearError(
      404,
      'No se encontró el programa académico del estudiante'
    );
  }

  if (!laborSocial) {
    throw crearError(
      404,
      'No se encontró la labor social seleccionada'
    );
  }

  if (!lineaAccion) {
    throw crearError(
      404,
      'No se encontró la línea de acción'
    );
  }

  return {
    trabajo,
    data: {
      nombreFacultad:
        facultad.nombre_facultad || '',
      nombrePrograma:
        programa.nombre_programa || '',
      nombreLaborSocial:
        laborSocial.nombre_labores || '',
      nombreCompleto:
        estudiante.nombre_estudiante || '',
      codigoUniversitario:
        estudiante.codigo || '',
      lineaAccion:
        lineaAccion.nombre_linea || '',
      nombreInstitucion: limpiarTexto(
        body.nombreInstitucion
      ),
      nombreResponsable: limpiarTexto(
        body.nombreResponsable
      ),
      fechaPresentacion: limpiarTexto(
        body.fechaPresentacion
      ),
      periodoEstimado: limpiarTexto(
        body.periodoEstimado
      ),
      introduccion: limpiarTexto(
        body.introduccion
      ),
      justificacion: limpiarTexto(
        body.justificacion
      ),
      objetivoGeneral: limpiarTexto(
        body.objetivoGeneral
      ),
      objetivosEspecificos: limpiarTexto(
        body.objetivosEspecificos
      ),
      nombreEntidad: limpiarTexto(
        body.nombreEntidad
      ),
      misionVision: limpiarTexto(
        body.misionVision
      ),
      areasIntervencion: limpiarTexto(
        body.areasIntervencion
      ),
      ubicacionPoblacion: limpiarTexto(
        body.ubicacionPoblacion
      ),
      areaInfluencia: limpiarTexto(
        body.areaInfluencia
      ),
      metodologiaIntervencion: limpiarTexto(
        body.metodologiaIntervencion
      ),
      recursosRequeridos: limpiarTexto(
        body.recursosRequeridos
      ),
      resultadosEsperados: limpiarTexto(
        body.resultadosEsperados
      ),
    },
  };
};

const previsualizarPlanPdf = async (
  req,
  res
) => {
  try {
    const usuarioId =
      req.user?.id ||
      req.user?.id_usuario;

    if (!usuarioId) {
      return res.status(401).json({
        message: 'Usuario no autenticado',
      });
    }

    const anexoPdf = validarAnexoPdf(
      req.file
    );

    const actividades = obtenerActividades(
      req.body.actividades
    );

    const { data } = await obtenerDatosPlan(
      usuarioId,
      req.body
    );

    validarCamposPlan(data);

    const actividadesValidadas =
      validarActividades(
        actividades,
        data.periodoEstimado
      );

    const pdf =
      await generarPlanServicioSocialPdf(
        {
          ...data,
          actividades:
            actividadesValidadas,
        },
        [anexoPdf]
      );

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      'inline; filename="PLAN-SERVICIO-SOCIAL-UDH.pdf"'
    );

    res.setHeader(
      'Content-Length',
      pdf.length
    );

    return res.send(pdf);
  } catch (error) {
    console.error(
      'Error al previsualizar plan social:',
      error
    );

    return res
      .status(error.status || 500)
      .json({
        message:
          error.message ||
          'Error al generar el plan de servicio social',
      });
  }
};

const guardarPlanPdf = async (
  req,
  res
) => {
  let transaction = null;
  let rutaArchivoNuevo = null;

  try {
    const usuarioId =
      req.user?.id ||
      req.user?.id_usuario;

    if (!usuarioId) {
      return res.status(401).json({
        message: 'Usuario no autenticado',
      });
    }

    const anexoPdf = validarAnexoPdf(
      req.file
    );

    const actividades = obtenerActividades(
      req.body.actividades
    );

    const { trabajo, data } =
      await obtenerDatosPlan(
        usuarioId,
        req.body
      );

    const config =
      await SystemConfig.findByPk(1);

    if (!config) {
      throw crearError(
        500,
        'Configuración del sistema no encontrada'
      );
    }

    if (
      Number(
        config.inicio_servicio_social_habilitado
      ) !== 1 &&
      !trabajo.archivo_plan_social
    ) {
      throw crearError(
        403,
        'La subida del plan social está deshabilitada actualmente'
      );
    }

    if (
      !trabajo.carta_aceptacion_pdf ||
      trabajo.estado_plan_labor_social !==
        'aceptado'
    ) {
      throw crearError(
        400,
        'No puedes enviar el plan social. Se requiere carta de aceptación y estado del plan aprobado.'
      );
    }

    validarCamposPlan(data);

    const actividadesValidadas =
      validarActividades(
        actividades,
        data.periodoEstimado
      );

    const pdf =
      await generarPlanServicioSocialPdf(
        {
          ...data,
          actividades:
            actividadesValidadas,
        },
        [anexoPdf]
      );

    const directorio = path.join(
      __dirname,
      '../../../uploads/planes_labor_social'
    );

    await fs.mkdir(
      directorio,
      {
        recursive: true,
      }
    );

    const nombreArchivo =
      `plan_servicio_social_${trabajo.id}_${Date.now()}.pdf`;

    rutaArchivoNuevo = path.join(
      directorio,
      nombreArchivo
    );

    await fs.writeFile(
      rutaArchivoNuevo,
      pdf
    );

    const archivoAnterior =
      trabajo.archivo_plan_social || null;

    transaction =
      await sequelize.transaction();

    await CronogramaActividad.destroy({
      where: {
        trabajo_social_id:
          trabajo.id,
      },
      transaction,
    });

    await CronogramaActividad.bulkCreate(
      actividadesValidadas.map(
        (actividad) => ({
          trabajo_social_id:
            trabajo.id,
          actividad:
            actividad.actividad,
          justificacion:
            actividad.justificacion,
          fecha:
            actividad.fecha,
          fecha_fin_primero:
            actividad.fechaFin,
          resultados:
            actividad.resultados,
        })
      ),
      {
        transaction,
      }
    );

    await trabajo.update(
      {
        archivo_plan_social:
          nombreArchivo,
        conformidad_plan_social:
          'pendiente',
      },
      {
        transaction,
      }
    );

    await transaction.commit();
    transaction = null;

    if (
      archivoAnterior &&
      archivoAnterior !== nombreArchivo
    ) {
      const rutaAnterior = path.join(
        directorio,
        archivoAnterior
      );

      try {
        await fs.unlink(
          rutaAnterior
        );
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(
            'No se pudo eliminar el PDF anterior:',
            error
          );
        }
      }
    }

    return res.status(200).json({
      message:
        'Plan de servicio social generado y enviado correctamente',
      archivo: nombreArchivo,
      ruta:
        `/uploads/planes_labor_social/${nombreArchivo}`,
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          'Error al revertir la transacción:',
          rollbackError
        );
      }
    }

    if (rutaArchivoNuevo) {
      try {
        await fs.unlink(
          rutaArchivoNuevo
        );
      } catch (fileError) {
        if (
          fileError.code !== 'ENOENT'
        ) {
          console.error(
            'No se pudo eliminar el PDF generado:',
            fileError
          );
        }
      }
    }

    console.error(
      'Error al guardar plan social:',
      error
    );

    return res
      .status(error.status || 500)
      .json({
        message:
          error.message ||
          'Error al guardar el plan de servicio social',
      });
  }
};

const aceptarDesignacion = async (req, res) => {
  let transaction = null;

  const archivosGenerados = [];

  try {
    const usuarioId =
      req.user?.id ||
      req.user?.id_usuario;

    if (!usuarioId) {
      throw crearError(
        401,
        'Usuario no autenticado'
      );
    }

    const trabajoId = Number(req.params.id);

    if (
      !Number.isInteger(trabajoId) ||
      trabajoId <= 0
    ) {
      throw crearError(
        400,
        'ID de trabajo social inválido'
      );
    }

    const trabajo =
      await TrabajoSocialSeleccionado.findByPk(
        trabajoId
      );

    if (!trabajo) {
      throw crearError(
        404,
        'Trabajo social no encontrado'
      );
    }

    const docente = await Docentes.findOne({
      where: {
        id_docente: trabajo.docente_id,
        id_usuario: usuarioId,
      },
    });

    if (!docente) {
      throw crearError(
        403,
        'No tienes autorización para aceptar este trabajo social'
      );
    }

    if (!limpiarTexto(docente.firma_digital)) {
      throw crearError(
        400,
        'Debes registrar tu firma digital antes de aceptar el trabajo social'
      );
    }

    const estadoActual =
      limpiarTexto(
        trabajo.estado_plan_labor_social
      ).toLowerCase();

    if (
      estadoActual === 'aceptado' &&
      trabajo.carta_aceptacion_pdf
    ) {
      throw crearError(
        400,
        'Este trabajo social ya fue aceptado y cuenta con carta de aceptación'
      );
    }

    if (
      ![
        'pendiente',
        'rechazado',
        'aceptado',
      ].includes(estadoActual)
    ) {
      throw crearError(
        400,
        `No se puede aceptar un trabajo social en estado "${estadoActual}"`
      );
    }

    const [
      estudiante,
      facultad,
      programa,
    ] = await Promise.all([
      Estudiantes.findOne({
        where: {
          id_usuario: trabajo.usuario_id,
        },
      }),

      Facultades.findByPk(
        trabajo.facultad_id
      ),

      ProgramasAcademicos.findByPk(
        trabajo.programa_academico_id
      ),
    ]);

    if (!estudiante) {
      throw crearError(
        404,
        'No se encontraron los datos del estudiante'
      );
    }

    if (!facultad) {
      throw crearError(
        404,
        'No se encontró la facultad del estudiante'
      );
    }

    if (!programa) {
      throw crearError(
        404,
        'No se encontró el programa académico del estudiante'
      );
    }

    const esGrupal =
      limpiarTexto(
        trabajo.tipo_servicio_social
      ).toLowerCase() === 'grupal';

    let integrantes = [];

    if (esGrupal) {
      integrantes =
        await IntegranteGrupo.findAll({
          where: {
            trabajo_social_id:
              trabajo.id,
          },
          order: [
            ['id_integrante', 'ASC'],
          ],
        });

      if (integrantes.length === 0) {
        throw crearError(
          400,
          'El trabajo grupal no tiene integrantes registrados'
        );
      }
    }

    const cartasAnteriores =
      await CartaAceptacion.findAll({
        where: {
          trabajo_id:
            trabajo.id,
        },
        attributes: [
          'nombre_archivo_pdf',
        ],
      });

    const nombresArchivosAnteriores =
      cartasAnteriores
        .map(
          (carta) =>
            carta.nombre_archivo_pdf
        )
        .filter(Boolean);

    if (trabajo.carta_aceptacion_pdf) {
      nombresArchivosAnteriores.push(
        trabajo.carta_aceptacion_pdf
      );
    }

    const directorio = path.join(
      __dirname,
      '../../../uploads/cartas_aceptacion'
    );

    await fs.mkdir(
      directorio,
      {
        recursive: true,
      }
    );

    const baseUrl =
      obtenerBaseUrl(req);

    const timestamp = Date.now();

    const nombreCartaPrincipal =
      `carta_aceptacion_${trabajo.id}_${timestamp}.pdf`;

    const urlPrincipal =
      `${baseUrl}/api/trabajo-social/documentos-trabajo/${trabajo.id}`;

    const pdfPrincipal =
      await generarCartaAceptacionPdf({
        nombreFacultad:
          facultad.nombre_facultad,

        nombrePrograma:
          programa.nombre_programa,

        nombreEstudiante:
          estudiante.nombre_estudiante,

        nombreDocente:
          docente.nombre_docente,

        firmaDigital:
          docente.firma_digital,

        urlVerificacion:
          urlPrincipal,
      });

    const rutaCartaPrincipal =
      path.join(
        directorio,
        nombreCartaPrincipal
      );

    await fs.writeFile(
      rutaCartaPrincipal,
      pdfPrincipal
    );

    archivosGenerados.push(
      rutaCartaPrincipal
    );

    const cartasIntegrantes = [];

    if (esGrupal) {
      for (const integrante of integrantes) {
        const codigo =
          limpiarTexto(
            integrante.codigo
          );

        if (!codigo) {
          throw crearError(
            400,
            `Un integrante del grupo no tiene código universitario registrado`
          );
        }

        const nombreArchivo =
          `carta_aceptacion_${trabajo.id}_${codigo}.pdf`;

        const idVerificacion =
          `${trabajo.id}_${codigo}`;

        const urlVerificacion =
          `${baseUrl}/api/trabajo-social/documentos-trabajo/${idVerificacion}`;

        const pdfIntegrante =
          await generarCartaAceptacionPdf({
            nombreFacultad:
              integrante.facultad,

            nombrePrograma:
              integrante.programa_academico,

            nombreEstudiante:
              integrante.nombre_completo,

            nombreDocente:
              docente.nombre_docente,

            firmaDigital:
              docente.firma_digital,

            urlVerificacion,
          });

        const rutaArchivo =
          path.join(
            directorio,
            nombreArchivo
          );

        await fs.writeFile(
          rutaArchivo,
          pdfIntegrante
        );

        archivosGenerados.push(
          rutaArchivo
        );

        cartasIntegrantes.push({
          trabajo_id:
            trabajo.id,

          codigo_universitario:
            codigo,

          nombre_archivo_pdf:
            nombreArchivo,
        });
      }
    }

    transaction =
      await sequelize.transaction();

    await CartaAceptacion.destroy({
      where: {
        trabajo_id:
          trabajo.id,
      },
      transaction,
    });

    if (
      cartasIntegrantes.length > 0
    ) {
      await CartaAceptacion.bulkCreate(
        cartasIntegrantes,
        {
          transaction,
        }
      );
    }

    await trabajo.update(
      {
        estado_plan_labor_social:
          'aceptado',

        carta_aceptacion_pdf:
          nombreCartaPrincipal,
      },
      {
        transaction,
      }
    );

    await transaction.commit();

    transaction = null;

    const nuevosNombres =
      new Set([
        nombreCartaPrincipal,
        ...cartasIntegrantes.map(
          (carta) =>
            carta.nombre_archivo_pdf
        ),
      ]);

    const archivosAnterioresUnicos =
      [
        ...new Set(
          nombresArchivosAnteriores
        ),
      ];

    for (
      const nombreArchivo
      of archivosAnterioresUnicos
    ) {
      if (
        nuevosNombres.has(
          nombreArchivo
        )
      ) {
        continue;
      }

      const rutaAnterior =
        path.join(
          directorio,
          nombreArchivo
        );

      await eliminarArchivoSiExiste(
        rutaAnterior
      );
    }

    return res.status(200).json({
      message:
        'Trabajo social aceptado y carta de aceptación generada correctamente',

      trabajo_id:
        trabajo.id,

      estado_plan_labor_social:
        'aceptado',

      carta_aceptacion_pdf:
        nombreCartaPrincipal,

      tipo_servicio_social:
        trabajo.tipo_servicio_social,

      cartas_integrantes:
        cartasIntegrantes.length,
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          'Error al revertir la transacción de carta de aceptación:',
          rollbackError
        );
      }
    }

    for (
      const rutaArchivo
      of archivosGenerados
    ) {
      await eliminarArchivoSiExiste(
        rutaArchivo
      );
    }

    console.error(
      'Error al aceptar trabajo social:',
      error
    );

    return res
      .status(error.status || 500)
      .json({
        message:
          error.message ||
          'Error al aceptar el trabajo social',
      });
  }
};


const aprobarCartaTermino = async (req, res) => {
  let transaction = null;

  const archivosGenerados = [];

  try {
    const usuarioId =
      req.user?.id ||
      req.user?.id_usuario;

    if (!usuarioId) {
      throw crearError(
        401,
        'Usuario no autenticado'
      );
    }

    const trabajoId = Number(
      req.params.id
    );

    if (
      !Number.isInteger(trabajoId) ||
      trabajoId <= 0
    ) {
      throw crearError(
        400,
        'ID de trabajo social inválido'
      );
    }

    const trabajo =
      await TrabajoSocialSeleccionado.findByPk(
        trabajoId
      );

    if (!trabajo) {
      throw crearError(
        404,
        'Trabajo social no encontrado'
      );
    }

    const docente =
      await Docentes.findOne({
        where: {
          id_docente:
            trabajo.docente_id,
          id_usuario:
            usuarioId,
        },
      });

    if (!docente) {
      throw crearError(
        403,
        'No tienes autorización para aprobar esta solicitud de término'
      );
    }

    if (
      !limpiarTexto(
        docente.firma_digital
      )
    ) {
      throw crearError(
        400,
        'Debes registrar tu firma digital antes de aprobar la carta de término'
      );
    }

    if (
      trabajo.solicitud_termino !==
      'solicitada'
    ) {
      throw crearError(
        400,
        'No existe una solicitud de carta de término pendiente de aprobación'
      );
    }

    const [
      estudiante,
      facultad,
      programa,
      laborSocial,
    ] = await Promise.all([
      Estudiantes.findOne({
        where: {
          id_usuario:
            trabajo.usuario_id,
        },
      }),

      Facultades.findByPk(
        trabajo.facultad_id
      ),

      ProgramasAcademicos.findByPk(
        trabajo.programa_academico_id
      ),

      LaboresSociales.findByPk(
        trabajo.labor_social_id
      ),
    ]);

    if (!estudiante) {
      throw crearError(
        404,
        'No se encontraron los datos del estudiante'
      );
    }

    if (!facultad) {
      throw crearError(
        404,
        'No se encontró la facultad del estudiante'
      );
    }

    if (!programa) {
      throw crearError(
        404,
        'No se encontró el programa académico del estudiante'
      );
    }

    if (!laborSocial) {
      throw crearError(
        404,
        'No se encontró la labor social'
      );
    }

    const esGrupal =
      limpiarTexto(
        trabajo.tipo_servicio_social
      ).toLowerCase() === 'grupal';

    let integrantes = [];

    if (esGrupal) {
      integrantes =
        await IntegranteGrupo.findAll({
          where: {
            trabajo_social_id:
              trabajo.id,
          },
          order: [
            ['id_integrante', 'ASC'],
          ],
        });

      if (
        integrantes.length === 0
      ) {
        throw crearError(
          400,
          'El trabajo grupal no tiene integrantes registrados'
        );
      }
    }

    const cartasAnteriores =
      await CartaTermino.findAll({
        where: {
          trabajo_id:
            trabajo.id,
        },
        attributes: [
          'nombre_archivo_pdf',
        ],
      });

    const nombresAnteriores =
      cartasAnteriores
        .map(
          (carta) =>
            carta.nombre_archivo_pdf
        )
        .filter(Boolean);

    if (trabajo.carta_termino_pdf) {
      nombresAnteriores.push(
        trabajo.carta_termino_pdf
      );
    }

    const directorio =
      path.join(
        __dirname,
        '../../../uploads/cartas_termino'
      );

    const directorioIntegrantes =
      path.join(
        __dirname,
        '../../../uploads/cartas_termino_integrantes'
      );

    await Promise.all([
      fs.mkdir(
        directorio,
        {
          recursive: true,
        }
      ),

      fs.mkdir(
        directorioIntegrantes,
        {
          recursive: true,
        }
      ),
    ]);

    const baseUrl =
      obtenerBaseUrl(req);

    const timestamp =
      Date.now();

    const nombreCartaPrincipal =
      `carta_termino_${trabajo.id}_${timestamp}.pdf`;

    const urlPrincipal =
      `${baseUrl}/api/trabajo-social/documento-termino/${trabajo.id}`;

    const pdfPrincipal =
      await generarCartaTerminoPdf({
        nombreEstudiante:
          estudiante.nombre_estudiante,

        nombrePrograma:
          programa.nombre_programa,

        nombreFacultad:
          facultad.nombre_facultad,

        nombreLabor:
          laborSocial.nombre_labores,

        nombreDocente:
          docente.nombre_docente,

        firmaDigital:
          docente.firma_digital,

        urlVerificacion:
          urlPrincipal,
      });

    const rutaPrincipal =
      path.join(
        directorio,
        nombreCartaPrincipal
      );

    await fs.writeFile(
      rutaPrincipal,
      pdfPrincipal
    );

    archivosGenerados.push(
      rutaPrincipal
    );

    const cartasIntegrantes = [];

    if (esGrupal) {
      for (
        const integrante
        of integrantes
      ) {
        const codigo =
          limpiarTexto(
            integrante.codigo
          );

        const nombreCompleto =
          limpiarTexto(
            integrante.nombre_completo
          );

        const nombreFacultad =
          limpiarTexto(
            integrante.facultad
          );

        const nombrePrograma =
          limpiarTexto(
            integrante.programa_academico
          );

        if (!codigo) {
          throw crearError(
            400,
            'Un integrante del grupo no tiene código universitario registrado'
          );
        }

        if (!nombreCompleto) {
          throw crearError(
            400,
            `El integrante ${codigo} no tiene nombre registrado`
          );
        }

        if (!nombreFacultad) {
          throw crearError(
            400,
            `El integrante ${codigo} no tiene facultad registrada`
          );
        }

        if (!nombrePrograma) {
          throw crearError(
            400,
            `El integrante ${codigo} no tiene programa académico registrado`
          );
        }

        const nombreArchivo =
          `carta_termino_${trabajo.id}_${codigo}_${timestamp}.pdf`;

        const urlVerificacion =
          `${baseUrl}/api/trabajo-social/documento-termino/${trabajo.id}?codigo=${encodeURIComponent(codigo)}`;

        const pdfIntegrante =
          await generarCartaTerminoPdf({
            nombreEstudiante:
              nombreCompleto,

            nombrePrograma,

            nombreFacultad,

            nombreLabor:
              laborSocial.nombre_labores,

            nombreDocente:
              docente.nombre_docente,

            firmaDigital:
              docente.firma_digital,

            urlVerificacion,
          });

          const rutaArchivo = path.join(
            directorioIntegrantes,
            nombreArchivo
          );

        await fs.writeFile(
          rutaArchivo,
          pdfIntegrante
        );

        archivosGenerados.push(
          rutaArchivo
        );

        cartasIntegrantes.push({
          trabajo_id:
            trabajo.id,

          codigo_universitario:
            codigo,

          nombre_archivo_pdf:
            nombreArchivo,
        });
      }
    }

    transaction =
      await sequelize.transaction();

    await CartaTermino.destroy({
      where: {
        trabajo_id:
          trabajo.id,
      },
      transaction,
    });

    if (
      cartasIntegrantes.length > 0
    ) {
      await CartaTermino.bulkCreate(
        cartasIntegrantes,
        {
          transaction,
        }
      );
    }

    await trabajo.update(
      {
        solicitud_termino:
          'aprobada',

        carta_termino_pdf:
          nombreCartaPrincipal,
      },
      {
        transaction,
      }
    );

    await transaction.commit();

    transaction = null;

    const nuevosNombres =
      new Set([
        nombreCartaPrincipal,
        ...cartasIntegrantes.map(
          (carta) =>
            carta.nombre_archivo_pdf
        ),
      ]);

    const nombresAnterioresUnicos =
      [
        ...new Set(
          nombresAnteriores
        ),
      ];

    for (
      const nombreArchivo
      of nombresAnterioresUnicos
    ) {
      if (
        nuevosNombres.has(
          nombreArchivo
        )
      ) {
        continue;
      }

      await eliminarArchivoSiExiste(
        path.join(
          directorio,
          nombreArchivo
        )
      );

      await eliminarArchivoSiExiste(
        path.join(
          directorioIntegrantes,
          nombreArchivo
        )
      );
    }

    return res.status(200).json({
      message:
        'Carta de término aprobada y generada correctamente',

      trabajo_id:
        trabajo.id,

      solicitud_termino:
        'aprobada',

      carta_termino_pdf:
        nombreCartaPrincipal,

      tipo_servicio_social:
        trabajo.tipo_servicio_social,

      cartas_integrantes:
        cartasIntegrantes.length,
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          'Error al revertir la transacción de carta de término:',
          rollbackError
        );
      }
    }

    for (
      const rutaArchivo
      of archivosGenerados
    ) {
      await eliminarArchivoSiExiste(
        rutaArchivo
      );
    }

    console.error(
      'Error al aprobar carta de término:',
      error
    );

    return res
      .status(error.status || 500)
      .json({
        message:
          error.message ||
          'Error al aprobar la carta de término',
      });
  }
};

const generarCertificadoFinal = async (req, res) => {
  let transaction = null;

  const archivosGenerados = [];

  try {
    const trabajoId = Number(req.params.id);

    if (!Number.isInteger(trabajoId) || trabajoId <= 0) {
      throw crearError(400, 'ID de trabajo social inválido');
    }

    const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajoId);

    if (!trabajo) {
      throw crearError(404, 'Trabajo social no encontrado');
    }

    if (
      limpiarTexto(trabajo.estado_informe_final).toLowerCase() !==
      'aprobado'
    ) {
      throw crearError(
        400,
        'El informe final debe estar aprobado antes de generar el certificado'
      );
    }

    const [estudiante, programa] = await Promise.all([
      Estudiantes.findOne({
        where: { id_usuario: trabajo.usuario_id },
      }),

      ProgramasAcademicos.findByPk(trabajo.programa_academico_id),
    ]);

    if (!estudiante) {
      throw crearError(404, 'No se encontraron los datos del estudiante');
    }

    if (!programa) {
      throw crearError(
        404,
        'No se encontró el programa académico del estudiante'
      );
    }

    const esGrupal =
      limpiarTexto(trabajo.tipo_servicio_social).toLowerCase() === 'grupal';

    let integrantes = [];

    if (esGrupal) {
      integrantes = await IntegranteGrupo.findAll({
        where: { trabajo_social_id: trabajo.id },
        order: [['id_integrante', 'ASC']],
      });
    }

    const certificadosAnteriores = await CertificadoFinalMiembro.findAll({
      where: { trabajo_id: trabajo.id },
      attributes: ['nombre_archivo_pdf'],
    });

    const nombresAnteriores = certificadosAnteriores
      .map((c) => c.nombre_archivo_pdf)
      .filter(Boolean);

    if (trabajo.certificado_final) {
      nombresAnteriores.push(trabajo.certificado_final);
    }

    const directorio = path.join(
      __dirname,
      '../../../uploads/certificados_finales'
    );

    const directorioIntegrantes = path.join(
      __dirname,
      '../../../uploads/certificados_finales_miembros'
    );

    await Promise.all([
      fs.mkdir(directorio, { recursive: true }),
      fs.mkdir(directorioIntegrantes, { recursive: true }),
    ]);

    const baseUrl = obtenerBaseUrl(req);
    const timestamp = Date.now();

    const nombreCertificadoPrincipal =
      `certificado_final_${trabajo.id}_${timestamp}.pdf`;

    const urlPrincipal =
      `${baseUrl}/api/trabajo-social/documento-certificado-final/${trabajo.id}`;

    const pdfPrincipal = await generarCertificadoFinalPdf({
      nombreEstudiante: estudiante.nombre_estudiante,
      nombrePrograma: programa.nombre_programa,
      urlVerificacion: urlPrincipal,
    });

    const rutaPrincipal = path.join(directorio, nombreCertificadoPrincipal);

    await fs.writeFile(rutaPrincipal, pdfPrincipal);

    archivosGenerados.push(rutaPrincipal);

    const certificadosIntegrantes = [];

    if (esGrupal) {
      for (const integrante of integrantes) {
        const codigo = limpiarTexto(integrante.codigo);
        const nombreCompleto = limpiarTexto(integrante.nombre_completo);
        const nombrePrograma = limpiarTexto(integrante.programa_academico);

        if (!codigo || !nombreCompleto || !nombrePrograma) {
          console.warn(
            `Integrante con datos incompletos, se omite certificado (trabajo ${trabajo.id}, codigo ${codigo || 'desconocido'})`
          );
          continue;
        }

        const nombreArchivo =
          `certificado_final_${trabajo.id}_${codigo}_${timestamp}.pdf`;

        const urlVerificacion =
          `${baseUrl}/api/trabajo-social/documento-certificado-final/${trabajo.id}?codigo=${encodeURIComponent(codigo)}`;

        const pdfIntegrante = await generarCertificadoFinalPdf({
          nombreEstudiante: nombreCompleto,
          nombrePrograma,
          urlVerificacion,
        });

        const rutaArchivo = path.join(directorioIntegrantes, nombreArchivo);

        await fs.writeFile(rutaArchivo, pdfIntegrante);

        archivosGenerados.push(rutaArchivo);

        certificadosIntegrantes.push({
          trabajo_id: trabajo.id,
          codigo_universitario: codigo,
          nombre_archivo_pdf: nombreArchivo,
        });
      }
    }

    transaction = await sequelize.transaction();

    await CertificadoFinalMiembro.destroy({
      where: { trabajo_id: trabajo.id },
      transaction,
    });

    if (certificadosIntegrantes.length > 0) {
      await CertificadoFinalMiembro.bulkCreate(certificadosIntegrantes, {
        transaction,
      });
    }

    await trabajo.update(
      { certificado_final: nombreCertificadoPrincipal },
      { transaction }
    );

    await transaction.commit();

    transaction = null;

    const nuevosNombres = new Set([
      nombreCertificadoPrincipal,
      ...certificadosIntegrantes.map((c) => c.nombre_archivo_pdf),
    ]);

    const nombresAnterioresUnicos = [...new Set(nombresAnteriores)];

    for (const nombreArchivo of nombresAnterioresUnicos) {
      if (nuevosNombres.has(nombreArchivo)) {
        continue;
      }

      await eliminarArchivoSiExiste(path.join(directorio, nombreArchivo));

      await eliminarArchivoSiExiste(
        path.join(directorioIntegrantes, nombreArchivo)
      );
    }

    return res.status(200).json({
      message: 'Certificado final generado correctamente',
      trabajo_id: trabajo.id,
      certificado_final: nombreCertificadoPrincipal,
      tipo_servicio_social: trabajo.tipo_servicio_social,
      certificados_integrantes: certificadosIntegrantes.length,
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          'Error al revertir la transacción de certificado final:',
          rollbackError
        );
      }
    }

    for (const rutaArchivo of archivosGenerados) {
      await eliminarArchivoSiExiste(rutaArchivo);
    }

    console.error('Error al generar certificado final:', error);

    return res.status(error.status || 500).json({
      message: error.message || 'Error al generar el certificado final',
    });
  }
};

const obtenerDocumentoCertificadoFinal = async (req, res) => {
  try {
    const trabajoId = req.params.id;
    const { codigo } = req.query;

    let rutaPDF;

    if (codigo) {
      const registro = await CertificadoFinalMiembro.findOne({
        where: {
          trabajo_id: trabajoId,
          codigo_universitario: codigo,
        },
      });

      if (!registro?.nombre_archivo_pdf) {
        throw crearError(
          404,
          'Certificado del integrante no encontrado'
        );
      }

      rutaPDF = path.join(
        __dirname,
        '../../../uploads/certificados_finales_miembros',
        registro.nombre_archivo_pdf
      );
    } else {
      const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajoId);

      if (!trabajo?.certificado_final) {
        throw crearError(404, 'Certificado principal no encontrado');
      }

      rutaPDF = path.join(
        __dirname,
        '../../../uploads/certificados_finales',
        trabajo.certificado_final
      );
    }

    try {
      await fs.access(rutaPDF);
    } catch {
      throw crearError(404, 'Archivo PDF no existe en el servidor');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="Certificado_Final.pdf"'
    );

    return res.sendFile(rutaPDF);
  } catch (error) {
    console.error('Error al servir certificado final:', error);

    return res.status(error.status || 500).json({
      message: error.message || 'Error interno al servir certificado final',
    });
  }
};

module.exports = {
  healthCheck,
  previsualizarPlanPdf,
  guardarPlanPdf,
  aceptarDesignacion,
  aprobarCartaTermino,
  generarCertificadoFinal,
  obtenerDocumentoCertificadoFinal,
};
