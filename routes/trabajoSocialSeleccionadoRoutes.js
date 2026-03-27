const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const router = express.Router();
const multer = require('multer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
const { TrabajoSocialSeleccionado, IntegranteGrupo } = require('../models');
const ProgramasAcademicos = require('../models/ProgramasAcademicos');
const CronogramaActividades = require('../models/CronogramaActividad');
const LaboresSociales = require('../models/LaboresSociales');
const Estudiantes = require('../models/Estudiantes');
const Facultades = require('../models/Facultades'); 
const ObservacionTrabajoSocial = require('../models/ObservacionTrabajoSocial');
const LineaDeAccion = require('../models/LineaDeAccion'); 
const Docentes = require('../models/Docentes');
const { getDatosAcademicosUDH } = require('../services/udhservicenuevo');
const { Op } = require('sequelize');

const storageCertificadoFinal = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/certificados_finales');
  },
  filename: function (req, file, cb) {
    const uniqueName = `certificado_final_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const uploadCertificadoFinal = multer({
  storage: storageCertificadoFinal,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    if (ext !== '.pdf') {
      return cb(new Error('Solo se permiten archivos PDF'));
    }
    cb(null, true);
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/cartas_aceptacion'); 
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    if (ext !== '.pdf') {
      return cb(new Error('Solo se permiten archivos PDF'));
    }
    cb(null, true);
  }
});
const storageArchivoPlan = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/planes_labor_social');
    },
    filename: function (req, file, cb) {
      const uniqueName = Date.now() + '-' + file.originalname;
      cb(null, uniqueName);
    }
  });
  const uploadArchivoPlan = multer({
    storage: storageArchivoPlan,
    fileFilter: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      if (ext !== '.pdf') {
        return cb(new Error('Solo se permiten archivos PDF'));
      }
      cb(null, true);
    }
  });
const storageCartaTermino = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/cartas_termino');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true }); 
    }
    cb(null, dir); 
  },
  filename: function (req, file, cb) {
    const uniqueName = `carta_termino_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});


const storageInformeFinal = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/informes_finales'); 
  },
  filename: function (req, file, cb) {
    const uniqueName = `informe_final_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const uploadInformeFinal = multer({
  storage: storageInformeFinal,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    if (ext !== '.pdf') {
      return cb(new Error('Solo se permiten archivos PDF'));
    }
    cb(null, true);
  }
});

const uploadCartaTermino = multer({
  storage: storageCartaTermino,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    if (ext !== '.pdf') {
      return cb(new Error('Solo se permiten archivos PDF'));
    }
    cb(null, true);
  }
});

router.get('/supervisores',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor', 'programa-academico'),
  async (req, res) => {
    try {
      const rows = await TrabajoSocialSeleccionado.findAll({
        include: [
          { model: Estudiantes, attributes: ['nombre_estudiante'] },
          { model: ProgramasAcademicos, attributes: ['nombre_programa'] },
          { model: Docentes, attributes: ['nombre_docente'], as: 'Docente' }, 
        ],
        attributes: [
          'id',
          'estado_plan_labor_social',
          'carta_aceptacion_pdf',
          'usuario_id',
          'programa_academico_id',
          'docente_id'
        ],
        order: [['createdAt', 'DESC']]
      });

      const data = rows.map(r => {
        const p = r.get({ plain: true });
        return {
          id: p.id,
          estudiante: { nombre_estudiante: p.Estudiante?.nombre_estudiante || null },
          programa:   { nombre_programa:   p.ProgramasAcademico?.nombre_programa || null },
          estado: p.estado_plan_labor_social || 'pendiente',
          carta_aceptacion_pdf: p.carta_aceptacion_pdf || null,
          supervisor: { nombre_supervisor: p.Docente?.nombre_docente || null }
        };
      });

      res.status(200).json(data);
    } catch (error) {
      console.error('Error al obtener supervisores:', error);
      res.status(500).json({ message: 'Error al obtener supervisores', error });
    }
  }
);



router.get(
  '/estudiantes-finalizados',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico'),
  async (req, res) => {
    try {
      const rows = await TrabajoSocialSeleccionado.findAll({
        where: {
          estado_informe_final: 'aprobado',
          certificado_final: { [Op.ne]: null }
        },
        include: [
          {
            model: Estudiantes,
            required: true,
            attributes: [
              'id_estudiante',
              'id_usuario',
              'nombre_estudiante',
              'dni',
              'email',
              'codigo',
              'celular',
              'sede',
              'modalidad',
              'estado'
            ],
            include: [
              {
                model: ProgramasAcademicos,
                as: 'programa',
                attributes: ['id_programa', 'nombre_programa']
              },
              {
                model: Facultades,
                as: 'facultad',
                attributes: ['id_facultad', 'nombre_facultad']
              }
            ]
          }
        ],
        attributes: [
          'id',
          'usuario_id',
          'estado_informe_final',
          'certificado_final',
          'informe_final_pdf',
          'tipo_servicio_social',
          'createdAt'
        ],
        order: [['createdAt', 'DESC']]
      });

      const data = await Promise.all(
        rows.map(async (r) => {
          const p = r.get({ plain: true });

          const trabajo = {
            id: p.id,
            usuario_id: p.usuario_id,
            estado_informe_final: p.estado_informe_final,
            certificado_final: p.certificado_final,
            informe_final_pdf: p.informe_final_pdf,
            tipo_servicio_social: p.tipo_servicio_social,
            createdAt: p.createdAt
          };

          if ((p.tipo_servicio_social || '').toString().trim().toLowerCase() === 'grupal') {
            const integrantesDB = await IntegranteGrupo.findAll({
              where: { trabajo_social_id: p.id },
              attributes: [
                'id_integrante',
                'trabajo_social_id',
                'correo_institucional',
                'codigo',
                'nombre_completo',
                'dni',
                'facultad',
                'programa_academico',
                'estado',
                'createdAt',
                'updatedAt'
              ],
              order: [['id_integrante', 'ASC']]
            });

            trabajo.integrantes_grupo = integrantesDB.map((ig) => {
              const plain = ig.get({ plain: true });
              const correo = (plain.correo_institucional || '').trim();
              const codigo = plain.codigo || (correo.includes('@') ? correo.split('@')[0] : null);

              return {
                id_estudiante: null,
                id_usuario: null,
                nombre_estudiante: plain.nombre_completo || null,
                dni: plain.dni || null,
                email: correo || null,
                codigo: codigo || null,
                celular: null, 
                sede: null,    
                modalidad: null, 
                estado: plain.estado || 'NO_ATENDIDO',
                programa: plain.programa_academico
                  ? { id_programa: null, nombre_programa: plain.programa_academico }
                  : null,
                facultad: plain.facultad
                  ? { id_facultad: null, nombre_facultad: plain.facultad }
                  : null,
                __integrante_grupo: {
                  id_integrante: plain.id_integrante,
                  trabajo_social_id: plain.trabajo_social_id,
                  correo_institucional: correo,
                  estado: plain.estado || 'NO_ATENDIDO'
                }
              };
            });
          }

          return {
            estudiante: p.Estudiante,
            trabajo
          };
        })
      );

      return res.status(200).json({
        total: data.length,
        data,
        meta: { udhDown: false } 
      });
    } catch (error) {
      console.error('Error en /estudiantes-finalizados:', error);
      return res.status(500).json({
        message: 'Error al obtener estudiantes finalizados',
        error: error.message
      });
    }
  }
);


router.get('/informes-finales',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh'),
  async (req, res) => {
    try {
      const docente = await Docentes.findOne({
        where: { id_usuario: req.user.id },
        attributes: ['id_docente']
      });

      if (!docente) {
        return res.status(404).json({ message: 'Docente no encontrado para el usuario logueado' });
      }

      const informes = await TrabajoSocialSeleccionado.findAll({
        where: {
          docente_id: docente.id_docente,
          informe_final_pdf: { [Op.ne]: null },
          estado_informe_final: { [Op.in]: ['pendiente', 'aprobado'] },
          carta_termino_pdf: { [Op.ne]: null }
        },
        include: [
          {
            model: Estudiantes,
            attributes: ['nombre_estudiante']
          },
          {
            model: ProgramasAcademicos,
            attributes: ['nombre_programa']
          },
          {
            model: Facultades,
            as: 'Facultad',
            attributes: ['nombre_facultad']
          }
        ],
        attributes: [
          'id',
          'informe_final_pdf',
          'archivo_plan_social',
          'estado_informe_final',
          'createdAt',
          'certificado_final',
          'tipo_servicio_social',
          'usuario_id'            
        ]
      });

      res.status(200).json(informes);
    } catch (error) {
      console.error('Error al obtener informes finales:', error);
      res.status(500).json({ message: 'Error interno al obtener informes finales', error });
    }
  });
  

router.get(
  '/informes-finales-nuevo',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
    try {
      const { Op } = require('sequelize');

      const informes = await TrabajoSocialSeleccionado.findAll({
        where: {
          informe_final_pdf: { [Op.ne]: null },
          estado_informe_final: 'aprobado'
        },
        include: [
          {
            model: Estudiantes,
            attributes: ['nombre_estudiante']
          },
          {
            model: ProgramasAcademicos,
            attributes: ['nombre_programa']
          },
          {
            model: Facultades,
            as: 'Facultad',
            attributes: ['nombre_facultad']
          }
        ],
        attributes: [
          'id',
          'informe_final_pdf',
          'archivo_plan_social',
          'estado_informe_final',
          'createdAt',
          'certificado_final',
          'tipo_servicio_social',
          'usuario_id'
        ],
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json(informes);
    } catch (error) {
      console.error('Error al obtener informes finales aprobados:', error);
      res.status(500).json({
        message: 'Error interno al obtener informes finales aprobados',
        error
      });
    }
  }
);
  
router.delete('/seleccionado/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const trabajo = await TrabajoSocialSeleccionado.findByPk(id);

    if (!trabajo) {
      return res.status(404).json({ message: 'No se encontró la elección del trabajo social' });
    }

    await trabajo.destroy();

    res.status(200).json({ message: 'Elección eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar elección:', error);
    res.status(500).json({ message: 'Error al eliminar la elección' });
  }
});


// 📩 Ruta para guardar el informe final generado desde el frontend
router.post('/guardar-informe-final',
  authMiddleware,
  verificarRol('alumno'),
  uploadInformeFinal.single('archivo'),
  async (req, res) => {
  try {
    const { trabajo_id } = req.body;

    if (!trabajo_id || !req.file) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajo_id);

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo social no encontrado' });
    }

    await trabajo.update({ 
    informe_final_pdf: req.file.filename,
    estado_informe_final: 'pendiente' 
  });

    res.status(200).json({ message: 'Informe final guardado correctamente', archivo: req.file.filename });
  } catch (error) {
    console.error('Error al guardar el informe final:', error);
    res.status(500).json({ message: 'Error interno al guardar informe final', error });
  }
});

router.post(
  '/',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
    const t = await sequelize.transaction();

    try {
      const {
        usuario_id,
        programa_academico_id,
        docente_id,
        labor_social_id,
        facultad_id,
        tipo_servicio_social,
        linea_accion_id,
        integrantes
      } = req.body;

      if (!usuario_id || isNaN(usuario_id)) {
        await t.rollback();
        return res.status(400).json({ message: 'usuario_id inválido' });
      }

      if (!facultad_id || isNaN(facultad_id)) {
        await t.rollback();
        return res.status(400).json({ message: 'facultad_id inválido' });
      }

      if (!programa_academico_id || isNaN(programa_academico_id)) {
        await t.rollback();
        return res.status(400).json({ message: 'programa_academico_id inválido' });
      }

      if (!docente_id || isNaN(docente_id)) {
        await t.rollback();
        return res.status(400).json({ message: 'docente_id inválido' });
      }

      if (!labor_social_id || isNaN(labor_social_id)) {
        await t.rollback();
        return res.status(400).json({ message: 'labor_social_id inválido' });
      }

      if (!linea_accion_id || isNaN(linea_accion_id)) {
        await t.rollback();
        return res.status(400).json({ message: 'linea_accion_id inválido' });
      }

      if (!['individual', 'grupal'].includes(tipo_servicio_social)) {
        await t.rollback();
        return res.status(400).json({ message: 'tipo_servicio_social inválido' });
      }

      let integrantesProcesados = [];

      if (tipo_servicio_social === 'grupal') {
        if (!Array.isArray(integrantes)) {
          await t.rollback();
          return res.status(400).json({
            message: 'Debes enviar un arreglo de integrantes'
          });
        }

        if (integrantes.length === 0) {
          await t.rollback();
          return res.status(400).json({
            message: 'Debes enviar al menos un integrante'
          });
        }

        // Permite recibir:
        // integrantes: ["2019110518", "2018112233"]
        // o
        // integrantes: [{ codigo: "2019110518" }, { codigo: "2018112233" }]
        const codigos = integrantes
          .map(item => {
            if (typeof item === 'string' || typeof item === 'number') {
              return String(item).trim();
            }
            if (item && item.codigo) {
              return String(item.codigo).trim();
            }
            return '';
          })
          .filter(Boolean);

        if (codigos.length === 0) {
          await t.rollback();
          return res.status(400).json({
            message: 'No se enviaron códigos válidos'
          });
        }

        const codigoPropioEnIntegrantes = await Estudiantes.findOne({
          where: {
            id_usuario: parseInt(usuario_id),
            codigo: { [Op.in]: codigos }
          },
          attributes: ['codigo'],
          transaction: t
        });

        if (codigoPropioEnIntegrantes) {
          await t.rollback();
          return res.status(409).json({
            message: 'No puedes agregarte a ti mismo como integrante del grupo',
            codigo_conflictivo: codigoPropioEnIntegrantes.codigo
          });
        }

        const seen = new Set();
        const duplicados = new Set();

        for (const codigo of codigos) {
          if (seen.has(codigo)) duplicados.add(codigo);
          else seen.add(codigo);
        }

        if (duplicados.size > 0) {
          await t.rollback();
          return res.status(409).json({
            message: 'Hay códigos repetidos en el envío',
            duplicados: [...duplicados]
          });
        }

        const resultados = await Promise.all(
          codigos.map(async (codigo) => {
            const datos = await getDatosAcademicosUDH(codigo);
            return { codigoSolicitado: codigo, datos };
          })
        );

        const noEncontrados = resultados
          .filter(r => !r.datos)
          .map(r => r.codigoSolicitado);

        if (noEncontrados.length > 0) {
          await t.rollback();
          return res.status(404).json({
            message: 'No se encontraron datos académicos para algunos códigos',
            codigos_no_encontrados: noEncontrados
          });
        }

        const sinCorreo = resultados
          .filter(r => !r.datos.email)
          .map(r => r.codigoSolicitado);

        if (sinCorreo.length > 0) {
          await t.rollback();
          return res.status(400).json({
            message: 'Algunos estudiantes no tienen correo institucional en la consulta externa',
            codigos_sin_correo: sinCorreo
          });
        }

        const correosInvalidos = resultados
          .filter(r => !String(r.datos.email).toLowerCase().endsWith('@udh.edu.pe'))
          .map(r => ({
            codigo: r.codigoSolicitado,
            correo: r.datos.email
          }));

        if (correosInvalidos.length > 0) {
          await t.rollback();
          return res.status(400).json({
            message: 'Algunos correos recuperados no tienen dominio @udh.edu.pe',
            correos_invalidos: correosInvalidos
          });
        }

        const correosSet = new Set();
        const correosDuplicados = new Set();

        for (const r of resultados) {
          const correo = String(r.datos.email).trim().toLowerCase();
          if (correosSet.has(correo)) {
            correosDuplicados.add(correo);
          } else {
            correosSet.add(correo);
          }
        }

        if (correosDuplicados.size > 0) {
          await t.rollback();
          return res.status(409).json({
            message: 'La consulta devolvió correos institucionales repetidos',
            correos_duplicados: [...correosDuplicados]
          });
        }

        integrantesProcesados = resultados.map(r => ({
          trabajo_social_id: null, // se asigna luego
          nombre_completo: r.datos.nombre_completo || '',
          dni: r.datos.dni || '',
          facultad: r.datos.facultad || '',
          programa_academico: r.datos.programa || '',
          codigo: r.datos.codigo || r.codigoSolicitado,
          correo_institucional: String(r.datos.email).trim().toLowerCase(),
          estado: 'NO_ATENDIDO'
        }));

        const incompletos = integrantesProcesados.filter(i =>
          !i.nombre_completo ||
          !i.dni ||
          !i.facultad ||
          !i.programa_academico ||
          !i.codigo ||
          !i.correo_institucional
        );

        if (incompletos.length > 0) {
          await t.rollback();
          return res.status(400).json({
            message: 'Algunos integrantes tienen datos incompletos desde la API externa',
            integrantes_incompletos: incompletos.map(i => ({
              codigo: i.codigo,
              nombre_completo: i.nombre_completo,
              dni: i.dni,
              facultad: i.facultad,
              programa_academico: i.programa_academico,
              correo_institucional: i.correo_institucional
            }))
          });
        }

        const codigosIntegrantes = integrantesProcesados
          .map(i => String(i.codigo).trim())
          .filter(Boolean);

        const correosIntegrantes = integrantesProcesados
          .map(i => String(i.correo_institucional).trim().toLowerCase())
          .filter(Boolean);

        const integrantesYaRegistrados = await IntegranteGrupo.findAll({
          where: {
            [Op.or]: [
              { codigo: { [Op.in]: codigosIntegrantes } },
              { correo_institucional: { [Op.in]: correosIntegrantes } }
            ]
          },
          attributes: ['trabajo_social_id', 'codigo', 'correo_institucional'],
          transaction: t
        });

        if (integrantesYaRegistrados.length > 0) {
          const conflictosCodigo = [
            ...new Set(
              integrantesYaRegistrados
                .map(i => i.codigo)
                .filter(Boolean)
            )
          ];

          const conflictosCorreo = [
            ...new Set(
              integrantesYaRegistrados
                .map(i => String(i.correo_institucional || '').trim().toLowerCase())
                .filter(Boolean)
            )
          ];

          const trabajosRelacionados = [
            ...new Set(
              integrantesYaRegistrados
                .map(i => i.trabajo_social_id)
                .filter(Boolean)
            )
          ];

          await t.rollback();
          return res.status(409).json({
            message: 'Algunos integrantes ya pertenecen a otro trabajo social',
            codigos_conflictivos: conflictosCodigo,
            correos_conflictivos: conflictosCorreo,
            trabajos_sociales_relacionados: trabajosRelacionados
          });
        }
      }

      const nuevoRegistro = await TrabajoSocialSeleccionado.create(
        {
          usuario_id: parseInt(usuario_id),
          programa_academico_id: parseInt(programa_academico_id),
          docente_id: parseInt(docente_id),
          labor_social_id: parseInt(labor_social_id),
          facultad_id: parseInt(facultad_id),
          tipo_servicio_social,
          linea_accion_id: parseInt(linea_accion_id)
        },
        { transaction: t }
      );

      if (tipo_servicio_social === 'grupal') {
        const integrantesFinal = integrantesProcesados.map(i => ({
          ...i,
          trabajo_social_id: nuevoRegistro.id
        }));

        await IntegranteGrupo.bulkCreate(integrantesFinal, {
          validate: true,
          transaction: t
        });
      }

      await t.commit();

      return res.status(201).json({
        message: 'Trabajo social creado correctamente',
        id: nuevoRegistro.id,
        total_integrantes: tipo_servicio_social === 'grupal' ? integrantesProcesados.length : 0
      });

    } catch (error) {
      await t.rollback();
      console.error('❌ Error al guardar selección con rollback:', error);

      return res.status(500).json({
        message: 'Error al guardar selección',
        error: error.message
      });
    }
  }
);


// Ruta para obtener el estado del trabajo social por usuario_id
router.get('/usuario/:usuario_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh'),
  async (req, res) => {
  try {
    const usuario_id = req.params.usuario_id;

    const trabajoSocial = await TrabajoSocialSeleccionado.findOne({
      where: { usuario_id },
      attributes: [
        'id',
        'usuario_id',
        'programa_academico_id',
        'docente_id',
        'labor_social_id',
        'estado_plan_labor_social',
        'facultad_id',
        'linea_accion_id',
        'conformidad_plan_social',
        'archivo_plan_social',
        'tipo_servicio_social',
        'solicitud_termino',
        'carta_aceptacion_pdf',
        'informe_final_pdf',
        'carta_termino_pdf',
        'estado_informe_final',
        'certificado_final' 
      ],
       include: [
        {
          model: LineaDeAccion,
          as: 'lineaAccion', 
          attributes: ['nombre_linea'] 
        }
      ]
    });

  if (trabajoSocial) {
      const plain = trabajoSocial.get({ plain: true });
      plain.linea_accion = plain.lineaAccion ? plain.lineaAccion.nombre_linea : '';
      delete plain.lineaAccion; 
      res.status(200).json(plain);
    } else {
      res.status(200).json(null);
    }
  } catch (error) {
    console.error('Error al obtener estado del trabajo social:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});



router.get('/docente/:docente_id',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh'),
  async (req, res) => {
  try {
    const docente_id = req.params.docente_id;
    const trabajosSociales = await TrabajoSocialSeleccionado.findAll({
      where: { docente_id },
      include: [
        { model: ProgramasAcademicos, attributes: ['nombre_programa'] },
        { model: LaboresSociales, attributes: ['id_labores', 'nombre_labores'] },
        { model: Estudiantes, attributes: ['nombre_estudiante'] },
        { model: Facultades, as: 'Facultad', attributes: ['nombre_facultad'] },
      ],

      attributes: [
        'id',
        'usuario_id',
        'programa_academico_id',
        'estado_plan_labor_social',
        'labor_social_id',
        'archivo_plan_social',
        'conformidad_plan_social',
        'tipo_servicio_social',
        'solicitud_termino',
        'estado_informe_final'
      ]
    });

    res.status(200).json(trabajosSociales);
  } catch (error) {
    console.error('Error al obtener trabajos sociales de docente:', error);
    res.status(500).json({ message: 'Error al obtener trabajos sociales de docente', error });
  }
});

  

router.get(
  '/docente/:docente_id/nuevo',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh'),
  async (req, res) => {
    try {
      const docente_id = req.params.docente_id;

      const trabajosSociales = await TrabajoSocialSeleccionado.findAll({
        where: {
          docente_id,
          conformidad_plan_social: {
            [Op.in]: ['pendiente', 'aceptado']   
          }
        },
        include: [
          { model: ProgramasAcademicos, attributes: ['nombre_programa'] },
          { model: LaboresSociales, attributes: ['id_labores', 'nombre_labores'] },
          { model: Estudiantes, attributes: ['nombre_estudiante'] },
          { model: Facultades, as: 'Facultad', attributes: ['nombre_facultad'] },
        ],
        attributes: [
          'id',
          'usuario_id',
          'programa_academico_id',
          'estado_plan_labor_social',
          'labor_social_id',
          'archivo_plan_social',
          'conformidad_plan_social',
          'tipo_servicio_social',
          'solicitud_termino',
          'estado_informe_final'
        ],
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json(trabajosSociales);
    } catch (error) {
      console.error('Error al obtener trabajos sociales de docente:', error);
      res
        .status(500)
        .json({ message: 'Error al obtener trabajos sociales de docente', error });
    }
  }
);


  // Ruta PUT para actualizar el estado del trabajo social
  router.put('/:id',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh'),
  async (req, res) => { 
    try {
      const { id } = req.params;
      const { estado_plan_labor_social, conformidad_plan_social } = req.body;
      const estadosValidos = ['pendiente', 'aceptado', 'rechazado'];
      if (!estado_plan_labor_social && !conformidad_plan_social) {
        return res.status(400).json({ message: 'Debe proporcionar al menos un campo para actualizar.' });
      }

      if (estado_plan_labor_social && !estadosValidos.includes(estado_plan_labor_social)) {
        return res.status(400).json({ message: 'Estado de plan inválido.' });
      }

      if (conformidad_plan_social && !estadosValidos.includes(conformidad_plan_social)) {
        return res.status(400).json({ message: 'Estado de conformidad inválido.' });
      }

      const trabajoSocial = await TrabajoSocialSeleccionado.findOne({ where: { id } });

      if (!trabajoSocial) {
        return res.status(404).json({ message: 'Trabajo social no encontrado.' });
      }

      const camposActualizar = {};
      if (estado_plan_labor_social) camposActualizar.estado_plan_labor_social = estado_plan_labor_social;
      if (conformidad_plan_social) camposActualizar.conformidad_plan_social = conformidad_plan_social;

      const debeEliminarIntegrantes =
        trabajoSocial.tipo_servicio_social === 'grupal' &&
        (estado_plan_labor_social === 'rechazado' || conformidad_plan_social === 'rechazado');

      if (debeEliminarIntegrantes) {
        await IntegranteGrupo.destroy({
          where: { trabajo_social_id: trabajoSocial.id }
        });
      }

      if (conformidad_plan_social === 'rechazado' && trabajoSocial.archivo_plan_social) {
        const rutaArchivo = path.join(__dirname, '..', 'uploads', 'planes_labor_social', trabajoSocial.archivo_plan_social);

        try {
          if (fs.existsSync(rutaArchivo)) {
            await fs.promises.unlink(rutaArchivo); 
            console.log(`Archivo eliminado: ${rutaArchivo}`);
          }
          camposActualizar.archivo_plan_social = null; 
        } catch (error) {
          console.error('⚠️ Error al eliminar archivo del plan social:', error);
        }
      }
      await trabajoSocial.update(camposActualizar);

      res.status(200).json({
        message: 'Trabajo social actualizado correctamente.',
        data: trabajoSocial
      });

    } catch (error) {
      console.error('Error al actualizar el trabajo social:', error);
      res.status(500).json({ message: 'Error interno al actualizar el trabajo social.', error });
    }
  });

router.post('/generar-pdf/:id',
  authMiddleware,
  verificarRol('docente supervisor'),
  async (req, res) => {
  try {
    const { id } = req.params;

    const trabajo = await TrabajoSocialSeleccionado.findByPk(id, {
      include: [
        { model: Estudiantes, attributes: ['nombre_estudiante'] },
        { model: LaboresSociales, attributes: ['nombre_labores'] },
        { model: ProgramasAcademicos, attributes: ['nombre_programa'] },
      ]
    });

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo social no encontrado' });
    }

    const nombreArchivo = `carta_aceptacion_${trabajo.id}_${Date.now()}.pdf`;
    const rutaArchivo = path.join(__dirname, '../uploads/planes_labor_social', nombreArchivo);
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(rutaArchivo));

    doc.fontSize(18).text('Carta de Aceptación del Plan de Trabajo Social', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Nombre del estudiante: ${trabajo.Estudiante?.nombre_estudiante || 'No registrado'}`);
    doc.text(`Programa académico: ${trabajo.ProgramasAcademico?.nombre_programa || 'N/A'}`);
    doc.text(`Labor social: ${trabajo.LaboresSociale?.nombre_labores || 'N/A'}`);
    doc.text(`Fecha de aceptación: ${new Date().toLocaleDateString()}`);
    doc.end();
    await trabajo.update({ carta_aceptacion_pdf: nombreArchivo });

    res.status(200).json({
      message: 'Carta de aceptación generada correctamente',
      archivo: nombreArchivo
    });

  } catch (error) {
    console.error('Error al generar el PDF:', error);
    res.status(500).json({ message: 'Error al generar PDF', error });
  }
});
router.get('/pdf/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const trabajo = await TrabajoSocialSeleccionado.findByPk(id);

    if (!trabajo || !trabajo.carta_aceptacion_pdf) {
      return res.status(404).json({ message: 'Archivo no encontrado para este trabajo social' });
    }

    const rutaPDF = path.join(__dirname, '../uploads/planes_labor_social', trabajo.carta_aceptacion_pdf);
    if (!fs.existsSync(rutaPDF)) {
      return res.status(404).json({ message: 'Archivo PDF no existe en el servidor' });
    }
    res.sendFile(rutaPDF);
  } catch (error) {
    console.error('Error al servir el PDF:', error);
    res.status(500).json({ message: 'Error interno al servir PDF', error });
  }
});

router.post('/guardar-pdf-html',
  authMiddleware,
  verificarRol('docente supervisor'),
  upload.single('archivo'),
  async (req, res) => {
  try {
    const { trabajo_id } = req.body;

    if (!trabajo_id || !req.file) {
      return res.status(400).json({ message: 'ID de trabajo o archivo faltante' });
    }

    const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajo_id);

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo social no encontrado' });
    }
    await trabajo.update({
      carta_aceptacion_pdf: req.file.filename
    });

    res.status(200).json({
      message: 'PDF guardado correctamente',
      archivo: req.file.filename
    });

  } catch (error) {
    console.error('Error al guardar el PDF desde el frontend:', error);
    res.status(500).json({ message: 'Error al guardar el PDF', error });
  }
});



router.get('/certificado-final/:trabajo_id', async (req, res) => {
  try {
    const { trabajo_id } = req.params;

    const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajo_id, {
      attributes: ['certificado_final']
    });

    if (!trabajo || !trabajo.certificado_final) {
      return res.status(404).json({ message: 'Certificado final no encontrado' });
    }

    const rutaPDF = path.join(
      __dirname,
      '../uploads/certificados_finales',
      trabajo.certificado_final
    );

    if (!fs.existsSync(rutaPDF)) {
      return res.status(404).json({ message: 'Archivo PDF no existe en el servidor' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="certificado_final.pdf"'
    );

    return res.sendFile(rutaPDF);

  } catch (error) {
    console.error('Error al servir certificado final:', error);
    return res.status(500).json({ message: 'Error interno al servir certificado final' });
  }
});


router.get('/:id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh'),
  async (req, res) => {
  try {
    const { id } = req.params;

    const trabajo = await TrabajoSocialSeleccionado.findByPk(id, {
      include: [
        { model: Estudiantes, attributes: ['nombre_estudiante'] },
        { model: ProgramasAcademicos, attributes: ['nombre_programa'] },
        { model: LaboresSociales, attributes: ['nombre_labores'] },
      ]
    });

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo no encontrado' });
    }

    res.status(200).json(trabajo);
  } catch (error) {
    console.error('Error al obtener trabajo social por ID:', error);
    res.status(500).json({ message: 'Error interno', error });
  }
});



router.post('/subir-plan-social',
  authMiddleware,
  verificarRol('alumno'),
  uploadArchivoPlan.single('archivo_plan_social'),
  async (req, res) => {
  try {
    const { usuario_id } = req.body;
    const archivo = req.file?.filename;

    if (!usuario_id || !archivo) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    const trabajo = await TrabajoSocialSeleccionado.findOne({ where: { usuario_id } });

    if (!trabajo) {
      return res.status(404).json({ message: 'No se encontró trabajo social con ese usuario_id' });
    }

    await trabajo.update({
      archivo_plan_social: archivo,
      conformidad_plan_social: 'pendiente' 
    });

    res.status(200).json({ message: 'Archivo subido correctamente y estado actualizado', archivo });
  } catch (error) {
    console.error('Error al subir el plan social:', error);
    res.status(500).json({ message: 'Error interno al subir archivo', error });
  }
});



router.patch('/:id/solicitar-carta-termino',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
  const { id } = req.params;

  try {
    const trabajo = await TrabajoSocialSeleccionado.findByPk(id);

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo no encontrado' });
    }

    if (trabajo.solicitud_termino !== 'no_solicitada') {
      return res.status(400).json({ message: 'La solicitud ya fue enviada o está en revisión' });
    }

    trabajo.solicitud_termino = 'solicitada';
    await trabajo.save();

    res.json({ message: 'Carta de término solicitada correctamente', estado: trabajo.solicitud_termino });
  } catch (error) {
    console.error('Error al solicitar carta de término:', error);
    res.status(500).json({ message: 'Error al procesar la solicitud' });
  }
});



router.patch('/:id/respuesta-carta-termino',
  authMiddleware,
  verificarRol('docente supervisor'),
  async (req, res) => {
  const { id } = req.params;
  const { solicitud_termino } = req.body;

  const valoresPermitidos = ['aprobada', 'rechazada'];

  if (!valoresPermitidos.includes(solicitud_termino)) {
    return res.status(400).json({ message: 'Valor inválido para solicitud_termino' });
  }

  try {
    const trabajo = await TrabajoSocialSeleccionado.findByPk(id);

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo social no encontrado' });
    }
    if (trabajo.solicitud_termino !== 'solicitada') {
      return res.status(400).json({ message: 'Aún no hay solicitud activa para responder' });
    }

    await trabajo.update({ solicitud_termino });

    res.json({
      message: `Solicitud de carta de término ${solicitud_termino} correctamente.`,
      estado: trabajo.solicitud_termino
    });
  } catch (error) {
    console.error('Error al actualizar solicitud de término:', error);
    res.status(500).json({ message: 'Error al actualizar estado de la solicitud', error });
  }
});



router.post('/guardar-carta-termino',
  authMiddleware,
  verificarRol('docente supervisor'),
  uploadCartaTermino.single('archivo'),
  async (req, res) => {
  try {
    const { trabajo_id } = req.body;

    if (!trabajo_id || !req.file) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajo_id);

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo no encontrado' });
    }

    await trabajo.update({ carta_termino_pdf: req.file.filename });

    res.status(200).json({ message: 'Carta de término guardada correctamente', archivo: req.file.filename });
  } catch (error) {
    console.error('Error al guardar la carta de término:', error);
    res.status(500).json({ message: 'Error interno al guardar carta de término', error });
  }
});

router.patch('/estado/:id',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  const { id } = req.params;
  const { nuevo_estado, observacion } = req.body;

  const estadosValidos = ['pendiente', 'aprobado', 'rechazado'];
  if (!estadosValidos.includes(nuevo_estado)) {
    return res.status(400).json({ message: 'Estado inválido' });
  }

  // Si es rechazado, la observación es obligatoria
  if (nuevo_estado === 'rechazado' && (!observacion || observacion.trim() === '')) {
    return res.status(400).json({ message: 'Debe proporcionar una observación al rechazar el informe' });
  }

  try {
    const trabajo = await TrabajoSocialSeleccionado.findByPk(id);

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo social no encontrado' });
    }

    // Si es rechazado, guardar la observación
    if (nuevo_estado === 'rechazado') {
      await ObservacionTrabajoSocial.create({
        trabajo_id: id,
        usuario_id: req.user.id,
        tipo: 'rechazo_informe',
        observacion: observacion.trim()
      });
    }

    trabajo.estado_informe_final = nuevo_estado;
    await trabajo.save();

    res.status(200).json({
      message: `Estado del informe actualizado a '${nuevo_estado}' correctamente`,
      trabajo  
    });
  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.status(500).json({ message: 'Error al actualizar estado', error: error.message });
  }
});


router.post('/guardar-certificado-final',
  authMiddleware,
  verificarRol('gestor-udh'),
  uploadCertificadoFinal.single('archivo'),
  async (req, res) => {
  try {
    const { trabajo_id } = req.body;

    if (!trabajo_id || !req.file) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajo_id);

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo no encontrado' });
    }

    await trabajo.update({ certificado_final: req.file.filename });

    res.status(200).json({
      message: 'Certificado final guardado correctamente',
      archivo: req.file.filename
    });
  } catch (error) {
    console.error('Error al guardar el certificado final:', error);
    res.status(500).json({ message: 'Error interno al guardar certificado final', error });
  }
});


router.post('/guardar-carta-termino-html',
  authMiddleware,
  verificarRol('docente supervisor'),
  uploadCartaTermino.single('archivo'),
  async (req, res) => {
  try {
    const { trabajo_id } = req.body;

    if (!trabajo_id || !req.file) {
      return res.status(400).json({ message: 'ID de trabajo o archivo faltante' });
    }

    const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajo_id);

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo social no encontrado' });
    }

    await trabajo.update({
      carta_termino_pdf: req.file.filename 
    });

    res.status(200).json({
      message: 'PDF guardado correctamente en la tabla principal',
      archivo: req.file.filename
    });

  } catch (error) {
    console.error('Error al guardar carta de término desde frontend:', error);
    res.status(500).json({ message: 'Error al guardar PDF', error });
  }
});


router.get('/documentos-trabajo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const esMiembro = id.includes('_');

    let rutaPDF;

    if (esMiembro) {
      const nombreArchivo = `carta_aceptacion_${id}.pdf`;
      rutaPDF = path.join(__dirname, '../uploads/cartas_aceptacion', nombreArchivo);
    } else {
      const trabajo = await TrabajoSocialSeleccionado.findByPk(id);
      if (!trabajo || !trabajo.carta_aceptacion_pdf) {
        return res.status(404).json({ message: 'Archivo no encontrado para este trabajo social' });
      }

      rutaPDF = path.join(__dirname, '../uploads/cartas_aceptacion', trabajo.carta_aceptacion_pdf);
    }

    if (!fs.existsSync(rutaPDF)) {
      return res.status(404).json({ message: 'Archivo PDF no existe en el servidor' });
    }

    res.setHeader('Content-Disposition', `inline; filename="carta_aceptacion.pdf"`);
    res.sendFile(rutaPDF);

  } catch (error) {
    console.error('❌ Error al servir el PDF:', error);
    res.status(500).json({ message: 'Error interno al servir PDF', error });
  }
});



router.get("/documento-termino/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo } = req.query;

    let rutaPDF;

    // ✅ SI VIENE CODIGO = MIEMBRO
    if (codigo) {
      const registro = await CartasTermino.findOne({
        where: { trabajo_id: id, codigo_universitario: codigo },
      });

      if (!registro?.nombre_archivo_pdf) {
        return res.status(404).json({ message: "Carta del integrante no encontrada" });
      }

      rutaPDF = path.join(__dirname, "../uploads/cartas_termino", registro.nombre_archivo_pdf);
    } else {
      // ✅ PRINCIPAL
      const trabajo = await TrabajoSocialSeleccionado.findByPk(id);

      if (!trabajo?.carta_termino_pdf) {
        return res.status(404).json({ message: "Carta principal no encontrada" });
      }

      rutaPDF = path.join(__dirname, "../uploads/cartas_termino", trabajo.carta_termino_pdf);
    }

    if (!fs.existsSync(rutaPDF)) {
      return res.status(404).json({ message: "Archivo PDF no existe en el servidor" });
    }

    res.setHeader("Content-Disposition", `inline; filename="Carta_Termino.pdf"`);
    res.setHeader("Content-Type", "application/pdf");
    return res.sendFile(rutaPDF);
  } catch (error) {
    console.error("Error al servir carta de término:", error);
    return res.status(500).json({ message: "Error interno al servir PDF de término" });
  }
});



router.get('/seguimiento/:id_estudiante',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor', 'programa-academico'),
  async (req, res) => {
  try {
    const { id_estudiante } = req.params;
    const estudiante = await Estudiantes.findByPk(id_estudiante, {
      attributes: ['id_estudiante', 'id_usuario', 'nombre_estudiante', 'email'],
      include: [
        { model: ProgramasAcademicos, as: 'programa', attributes: ['nombre_programa'] }
      ]
    });

    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    const tramite = await TrabajoSocialSeleccionado.findOne({
      where: { usuario_id: estudiante.id_usuario },
      attributes: [
        'estado_plan_labor_social',
        'conformidad_plan_social',
        'solicitud_termino',
        'estado_informe_final'
      ]
    });
    const data = {
      estudiante: estudiante.nombre_estudiante,
      email: estudiante.email,
      programa: estudiante.programa?.nombre_programa || "SIN PROGRAMA",
      pasos: [
        { 
          paso: "Plan de Labor Social", 
          estado: tramite?.estado_plan_labor_social || "pendiente",
          tooltip: "El estudiante registró su plan de labor social para revisión."
        },
        { 
          paso: "Conformidad del Plan", 
          estado: tramite?.conformidad_plan_social || "pendiente",
          tooltip: "El docente supervisor debe aprobar o rechazar el plan presentado (documento pdf creado mediante el sistema)."
        },
        { 
          paso: "Solicitud de Carta de Término", 
          estado: tramite?.solicitud_termino || "no_solicitada",
          tooltip: "El estudiante aun no solicita la carta de término al docente superisor o el docente aun no le aprobo su solicitud."
        },
        { 
          paso: "Informe Final", 
          estado: tramite?.estado_informe_final || "pendiente",
          tooltip: "El informe final debe ser enviado y aprobado por el docente para finalizar el trámite y brindarle su certificado."
        }
      ]
    };

    res.status(200).json(data);

  } catch (error) {
    console.error("❌ Error en seguimiento:", error);
    res.status(500).json({ message: "Error al obtener seguimiento del trámite", error });
  }
});



router.get(
  '/fecha-fin-primero/:usuario_id',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor'),
  async (req, res) => {
    try {
      const { usuario_id } = req.params;
      const trabajo = await TrabajoSocialSeleccionado.findOne({
        where: { usuario_id },
        attributes: ['id']
      });

      if (!trabajo) {
        return res.status(404).json({
          message: 'No se encontró un trabajo social para este estudiante.'
        });
      }

      const cronogramas = await CronogramaActividades.findAll({
        where: { trabajo_social_id: trabajo.id },
        attributes: ['id', 'actividad', 'fecha_fin_primero'], 
        order: [['fecha_fin_primero', 'ASC']]
      });

      if (!cronogramas || cronogramas.length === 0) {
        return res.status(404).json({
          message: 'No se encontraron cronogramas para este trabajo social.'
        });
      }
      res.status(200).json({
        message: 'Fechas obtenidas correctamente',
        total: cronogramas.length,
        cronogramas
      });

    } catch (error) {
      console.error('❌ Error al obtener fechas_fin_primero:', error);
      res.status(500).json({
        message: 'Error interno al obtener fechas_fin_primero',
        error
      });
    }
  }
);



router.post(
  '/declinar',
  authMiddleware,
  verificarRol('docente supervisor'),
  async (req, res) => {
    try {
      const { trabajo_id, observacion, nuevo_estado } = req.body;

      if (!trabajo_id || !observacion || !nuevo_estado) {
        return res
          .status(400)
          .json({ message: 'trabajo_id, nuevo_estado y observacion son obligatorios' });
      }

      if (!['aceptado', 'rechazado'].includes(nuevo_estado)) {
        return res
          .status(400)
          .json({ message: 'nuevo_estado debe ser "aceptado" o "rechazado"' });
      }
      const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajo_id);

      if (!trabajo) {
        return res
          .status(404)
          .json({ message: 'Trabajo social no encontrado' });
      }

      if (trabajo.conformidad_plan_social !== null) {
        return res.status(400).json({
          message: `Ya no se puede declinar porque la conformidad del plan social está en estado "${trabajo.conformidad_plan_social}".`
        });
      }

      const estadoActual = trabajo.estado_plan_labor_social;
      if (estadoActual === nuevo_estado) {
        return res.status(400).json({
          message: `El trabajo ya está en estado "${estadoActual}".`
        });
      }

      if (estadoActual === 'aceptado' && nuevo_estado === 'rechazado') {
        if (trabajo.carta_aceptacion_pdf) {
          const rutaPDF = path.join(
            __dirname,
            '..',
            'uploads',
            'planes_labor_social',
            trabajo.carta_aceptacion_pdf
          );

          try {
            if (fs.existsSync(rutaPDF)) {
              await fs.promises.unlink(rutaPDF);
              console.log('🗑️ Carta de aceptación eliminada:', rutaPDF);
            }
          } catch (err) {
            console.error('⚠️ Error al eliminar carta_aceptacion_pdf:', err);
          }
        }

        await trabajo.update({
          estado_plan_labor_social: 'rechazado',
          carta_aceptacion_pdf: null
        });
      }

      else if (estadoActual === 'rechazado' && nuevo_estado === 'aceptado') {
        await trabajo.update({
          estado_plan_labor_social: 'aceptado'
        });
      }

      else {
        return res.status(400).json({
          message: `Transición de estado no permitida: ${estadoActual} → ${nuevo_estado}`
        });
      }

      let usuarioId = null;
      if (req.user) {
        usuarioId = req.user.id || req.user.id_usuario || null;
      }

      await ObservacionTrabajoSocial.create({
        trabajo_id: trabajo.id,
        usuario_id: usuarioId,
        tipo: 'cambio_estado', 
        observacion
      });

      return res.status(200).json({
        message: `Estado cambiado de "${estadoActual}" a "${nuevo_estado}" y observación registrada correctamente.`
      });
    } catch (error) {
      console.error('❌ Error al cambiar estado del trabajo social:', error);
      return res.status(500).json({
        message: 'Error interno al cambiar estado del trabajo social',
        error: error.message
      });
    }
  }
);



router.put(
  '/actualizar-fecha/:id',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor'),
  async (req, res) => {
    try {
      const { id } = req.params; 
      const { fecha_fin_primero, resultados } = req.body;
      if (!fecha_fin_primero) {
        return res.status(400).json({ message: 'La fecha_fin_primero es obligatoria.' });
      }

      const cronograma = await CronogramaActividades.findByPk(id);

      if (!cronograma) {
        return res.status(404).json({ message: 'No se encontró el cronograma con el ID especificado.' });
      }

      cronograma.fecha_fin_primero = fecha_fin_primero;
      if (resultados) cronograma.resultados = resultados;

      await cronograma.save();

      res.status(200).json({
        message: 'Fecha actualizada correctamente',
        cronograma,
      });
    } catch (error) {
      console.error('Error al actualizar la fecha:', error);
      res.status(500).json({ message: 'Error interno al actualizar la fecha', error });
    }
  }
);




router.get(
  '/cambio-asesor/detalle',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
    try {
      const trabajos = await TrabajoSocialSeleccionado.findAll({
        where: { estado_plan_labor_social: 'aceptado' },
        include: [
          {
            model: Estudiantes,
            attributes: ['nombre_estudiante', 'programa_academico_id'],
            include: [
              {
                model: ProgramasAcademicos,
                as: 'programa', 
                attributes: ['id_programa', 'nombre_programa'],
              },
            ],
          },
          {
            model: Docentes,
            attributes: ['nombre_docente'],
          },
        ],
        attributes: [
          'id',
          'programa_academico_id', 
          'docente_id',
          'usuario_id',
        ],
        order: [['id', 'ASC']],
      });

      const data = trabajos.map((t) => {
        const plain = t.get({ plain: true });
        return {
          id: plain.id,
          programa_academico_id: plain.programa_academico_id,
          nombre_estudiante: plain.Estudiante?.nombre_estudiante || '—',
          asesor: plain.Docente?.nombre_docente || 'Sin asignar',
          programa_academico:
            plain.Estudiante?.programa?.nombre_programa || '—', 
        };
      });

      res.status(200).json({
        message:
          data.length > 0
            ? 'Listado de trabajos sociales aceptados obtenido correctamente'
            : 'No se encontraron trabajos sociales aceptados.',
        total: data.length,
        data,
      });
    } catch (error) {
      console.error('Error al obtener trabajos sociales con detalle:', error);
      res.status(500).json({
        message: 'Error interno al obtener trabajos sociales con detalle',
        error: error.message,
      });
    }
  }
);



router.get(
  '/motivo-rechazo/:trabajoId',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
    try {
      const { trabajoId } = req.params;

      const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajoId);
      if (!trabajo) {
        return res.status(404).json({ message: 'Trabajo social no encontrado.' });
      }

      if (trabajo.estado_plan_labor_social !== 'rechazado') {
        return res.status(400).json({
          message: 'Este trabajo no se encuentra rechazado, no hay motivo que mostrar.'
        });
      }

      const observacion = await ObservacionTrabajoSocial.findOne({
        where: {
          trabajo_id: trabajoId,
          tipo: 'cambio_estado',
        },
        order: [['createdAt', 'DESC']],
      });

      if (!observacion) {
        return res.status(404).json({
          message: 'No se encontró un motivo de rechazo registrado.'
        });
      }

      return res.json({
        motivo: observacion.observacion,
        fecha: observacion.createdAt,
      });
    } catch (error) {
      console.error('Error al obtener motivo de rechazo:', error);
      return res.status(500).json({
        message: 'Error interno al obtener el motivo de rechazo.',
        error: error.message,
      });
    }
  }
);



router.put(
  '/cambio-asesor/:id',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { nuevo_docente_id } = req.body;

      if (!nuevo_docente_id) {
        return res.status(400).json({
          message: 'Debe proporcionar el ID del nuevo asesor (nuevo_docente_id).',
        });
      }

      const trabajo = await TrabajoSocialSeleccionado.findByPk(id);
      if (!trabajo) {
        return res.status(404).json({
          message: 'No se encontró el trabajo social especificado.',
        });
      }

      const docenteExiste = await Docentes.findByPk(nuevo_docente_id);
      if (!docenteExiste) {
        return res.status(404).json({
          message: 'El docente seleccionado no existe.',
        });
      }

      trabajo.docente_id = nuevo_docente_id;
      await trabajo.save();

      res.status(200).json({
        message: 'Asesor actualizado correctamente.',
        data: {
          id_trabajo: trabajo.id,
          nuevo_docente_id,
          nombre_docente: docenteExiste.nombre_docente,
        },
      });
    } catch (error) {
      console.error('Error al actualizar el asesor:', error);
      res.status(500).json({
        message: 'Error interno al actualizar el asesor.',
        error: error.message,
      });
    }
  }
);

// Ruta para obtener el motivo de rechazo del informe final
router.get(
  '/motivo-rechazo-informe/:trabajoId',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
    try {
      const { trabajoId } = req.params;

      const trabajo = await TrabajoSocialSeleccionado.findByPk(trabajoId);
      if (!trabajo) {
        return res.status(404).json({ message: 'Trabajo social no encontrado.' });
      }

      if (trabajo.estado_informe_final !== 'rechazado') {
        return res.status(400).json({
          message: 'Este informe no se encuentra rechazado, no hay motivo que mostrar.'
        });
      }

      const observacion = await ObservacionTrabajoSocial.findOne({
        where: {
          trabajo_id: trabajoId,
          tipo: 'rechazo_informe',
        },
        order: [['createdAt', 'DESC']],
      });

      if (!observacion) {
        return res.status(404).json({
          message: 'No se encontró un motivo de rechazo registrado.'
        });
      }

      return res.json({
        motivo: observacion.observacion,
        fecha: observacion.createdAt,
      });
    } catch (error) {
      console.error('Error al obtener motivo de rechazo del informe:', error);
      return res.status(500).json({
        message: 'Error interno al obtener el motivo de rechazo.',
        error: error.message,
      });
    }
  }
);

module.exports = router;
