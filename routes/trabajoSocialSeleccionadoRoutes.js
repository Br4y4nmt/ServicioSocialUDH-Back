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
    cb(null, 'uploads/planes_labor_social'); 
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


// 📄 Configuración para guardar el informe final
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
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor'),
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

      let udhDown = false;
      
      try {
        const primerGrupal = rows.find((r) => {
          const p = r.get({ plain: true });
          return (p.tipo_servicio_social || '').toString().trim().toLowerCase() === 'grupal';
        });

        if (primerGrupal) {
          const pTest = primerGrupal.get({ plain: true });
          const igTest = await IntegranteGrupo.findOne({
            where: { trabajo_social_id: pTest.id },
            attributes: ['correo_institucional']
          });

          if (igTest) {
            const correoTest = (igTest.correo_institucional || '').trim();
            const codigoTest = correoTest.includes('@') ? correoTest.split('@')[0] : correoTest;

            const test = await getDatosAcademicosUDH(codigoTest);
            if (!test) udhDown = true; // <- tu service devuelve null cuando falla
          }
        }
      } catch (e) {
        // Si el test falla por cualquier motivo, lo tratamos como "down"
        udhDown = true;
      }

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

          // ✅ Si es grupal: traer integrantes + estado desde BD + (si UDH está OK) consultar UDH
          if ((p.tipo_servicio_social || '').toString().trim().toLowerCase() === 'grupal') {
            const integrantesDB = await IntegranteGrupo.findAll({
              where: { trabajo_social_id: p.id },
              attributes: [
                'id_integrante',
                'trabajo_social_id',
                'correo_institucional',
                'estado',
                'createdAt',
                'updatedAt'
              ]
            });

            const integrantes = await Promise.all(
              integrantesDB.map(async (ig) => {
                const plain = ig.get({ plain: true });
                const correo = (plain.correo_institucional || '').trim();
                const codigo = correo.includes('@') ? correo.split('@')[0] : correo;

                // ✅ Si UDH está caída, NO llamamos la API externa (evita timeouts por integrante)
                if (udhDown) {
                  return {
                    id_estudiante: null,
                    id_usuario: null,
                    nombre_estudiante: null,
                    dni: null,
                    email: correo || null,
                    codigo: codigo || null,
                    celular: null,
                    sede: null,
                    modalidad: null,
                    estado: plain.estado || 'NO_ATENDIDO',
                    programa: null,
                    facultad: null,
                    __integrante_grupo: {
                      id_integrante: plain.id_integrante,
                      trabajo_social_id: plain.trabajo_social_id,
                      correo_institucional: correo,
                      estado: plain.estado || 'NO_ATENDIDO',
                      error_udh: 'UDH_DOWN'
                    }
                  };
                }

                // ✅ UDH OK: consultamos la API externa
                const udh = await getDatosAcademicosUDH(codigo);

                // Si tu service devolvió null, igualmente devolvemos el integrante
                if (!udh) {
                  return {
                    id_estudiante: null,
                    id_usuario: null,
                    nombre_estudiante: null,
                    dni: null,
                    email: correo || null,
                    codigo: codigo || null,
                    celular: null,
                    sede: null,
                    modalidad: null,
                    estado: plain.estado || 'NO_ATENDIDO',
                    programa: null,
                    facultad: null,
                    __integrante_grupo: {
                      id_integrante: plain.id_integrante,
                      trabajo_social_id: plain.trabajo_social_id,
                      correo_institucional: correo,
                      estado: plain.estado || 'NO_ATENDIDO',
                      error_udh: 'UDH_NULL'
                    }
                  };
                }

                // ✅ Tu service ya devuelve:
                // { nombre_completo, dni, codigo, facultad, programa, ciclo }
                return {
                  id_estudiante: null,
                  id_usuario: null,
                  nombre_estudiante: udh.nombre_completo || null,
                  dni: udh.dni || null,
                  email: correo || null,
                  codigo: udh.codigo || codigo || null,
                  celular: udh.celular || null,
                  sede: udh.sede || null,
                  modalidad: udh.modalidad || null,
                  estado: plain.estado || 'NO_ATENDIDO',
                  programa: udh.programa
                    ? { id_programa: null, nombre_programa: udh.programa }
                    : null,
                  facultad: udh.facultad
                    ? { id_facultad: null, nombre_facultad: udh.facultad }
                    : null,
                  ciclo: udh.ciclo ?? null,
                  __integrante_grupo: {
                    id_integrante: plain.id_integrante,
                    trabajo_social_id: plain.trabajo_social_id,
                    correo_institucional: correo,
                    estado: plain.estado || 'NO_ATENDIDO'
                  }
                };
              })
            );

            trabajo.integrantes_grupo = integrantes;
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
        meta: {
          udhDown
        }
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
  verificarRol('docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
    try {
      const informes = await TrabajoSocialSeleccionado.findAll({
        where: {
          informe_final_pdf: { [require('sequelize').Op.ne]: null }
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

router.post('/',
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
        correos // 👈 NUEVO: viene del frontend cuando es grupal
      } = req.body;

      // Validaciones base
      if (!usuario_id || isNaN(usuario_id)) {
        await t.rollback();
        return res.status(400).json({ message: 'usuario_id inválido' });
      }

      if (!facultad_id || isNaN(facultad_id)) {
        await t.rollback();
        return res.status(400).json({ message: 'facultad_id inválido' });
      }

      if (!['individual', 'grupal'].includes(tipo_servicio_social)) {
        await t.rollback();
        return res.status(400).json({ message: 'tipo_servicio_social inválido' });
      }

      // ✅ Si es grupal, validar correos ANTES de crear el trabajo
      let correosNorm = [];
      if (tipo_servicio_social === 'grupal') {
        if (!Array.isArray(correos)) {
          await t.rollback();
          return res.status(400).json({ message: 'Debes enviar un arreglo de correos' });
        }

        // Normalizar
        correosNorm = correos
          .map(c => String(c || '').trim().toLowerCase())
          .filter(Boolean);

        if (correosNorm.length === 0) {
          await t.rollback();
          return res.status(400).json({ message: 'No se enviaron correos válidos' });
        }

        // Dominio UDH
        const invalidos = correosNorm.filter(c => !c.endsWith('@udh.edu.pe'));
        if (invalidos.length) {
          await t.rollback();
          return res.status(400).json({
            message: 'Hay correos con dominio inválido (solo @udh.edu.pe)',
            invalidos
          });
        }

        // Duplicados dentro del request
        const seen = new Set();
        const duplicadosReq = new Set();
        for (const c of correosNorm) {
          if (seen.has(c)) duplicadosReq.add(c);
          else seen.add(c);
        }

        if (duplicadosReq.size > 0) {
          await t.rollback();
          return res.status(409).json({
            message: 'Hay correos repetidos en el envío',
            duplicados: [...duplicadosReq]
          });
        }
      }

      // ✅ 1) Crear trabajo social (aún NO se confirma)
      const nuevoRegistro = await TrabajoSocialSeleccionado.create({
        usuario_id: parseInt(usuario_id),
        programa_academico_id: parseInt(programa_academico_id),
        docente_id: parseInt(docente_id),
        labor_social_id: parseInt(labor_social_id),
        facultad_id: parseInt(facultad_id),
        tipo_servicio_social,
        linea_accion_id: parseInt(linea_accion_id)
      }, { transaction: t });

      // ✅ 2) Si es grupal, guardar integrantes en la misma transacción
      if (tipo_servicio_social === 'grupal') {
        await IntegranteGrupo.bulkCreate(
          correosNorm.map(correo => ({
            trabajo_social_id: nuevoRegistro.id,
            correo_institucional: correo
          })),
          { validate: true, transaction: t }
        );
      }

      // ✅ 3) Confirmar todo
      await t.commit();

      return res.status(201).json({
        message: 'Trabajo social creado correctamente',
        id: nuevoRegistro.id
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


// 🔍 Ver / verificar certificado final del estudiante principal (QR)
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
router.get('/informes-finales/programa/:programa_academico_id',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
    try {
      const { programa_academico_id } = req.params;

      const informes = await TrabajoSocialSeleccionado.findAll({
        where: {
          programa_academico_id,
          informe_final_pdf: { [require('sequelize').Op.ne]: null }
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



router.patch('/estado/:id',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  const { id } = req.params;
  const { nuevo_estado } = req.body;

  const estadosValidos = ['pendiente', 'aprobado', 'rechazado'];
  if (!estadosValidos.includes(nuevo_estado)) {
    return res.status(400).json({ message: 'Estado inválido' });
  }

  try {
    const trabajo = await TrabajoSocialSeleccionado.findByPk(id);

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo social no encontrado' });
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

      rutaPDF = path.join(__dirname, '../uploads/planes_labor_social', trabajo.carta_aceptacion_pdf);
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



router.get('/documento-termino/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const esMiembro = id.includes('_');
    let rutaPDF;

    if (esMiembro) {
      const nombreArchivo = `carta_Termino_${id}.pdf`;
      rutaPDF = path.join(__dirname, '../uploads/cartas_termino', nombreArchivo);
    } else {
      const trabajo = await TrabajoSocialSeleccionado.findByPk(id);
      if (!trabajo || !trabajo.carta_termino_pdf) {
        return res.status(404).json({ message: 'Archivo no encontrado para este trabajo social' });
      }

      rutaPDF = path.join(__dirname, '../uploads/cartas_termino', trabajo.carta_termino_pdf);
    }

    if (!fs.existsSync(rutaPDF)) {
      return res.status(404).json({ message: 'Archivo PDF no existe en el servidor' });
    }

    res.setHeader('Content-Disposition', `inline; filename="Carta_Termino.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(rutaPDF);

  } catch (error) {
    console.error('Error al servir carta de término:', error);
    res.status(500).json({ message: 'Error interno al servir PDF de término', error });
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

module.exports = router;
