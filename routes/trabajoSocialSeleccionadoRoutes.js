const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const router = express.Router();
const multer = require('multer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const TrabajoSocialSeleccionado = require('../models/TrabajoSocialSeleccionado');
const ProgramasAcademicos = require('../models/ProgramasAcademicos');
const CronogramaActividades = require('../models/CronogramaActividad');
const LaboresSociales = require('../models/LaboresSociales');
const Estudiantes = require('../models/Estudiantes');
const Facultades = require('../models/Facultades'); 
const LineaDeAccion = require('../models/LineaDeAccion'); 
const Docentes = require('../models/Docentes');
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


// Configuración de Multer para guardar PDFs
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/planes_labor_social'); // asegúrate de crear esta carpeta
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
// ✅ CONFIGURACIÓN 2 - Para archivo_plan_social (NUEVA CONFIGURACIÓN QUE DEBES AGREGAR AQUÍ 👇)
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
  // 📂 Nueva configuración para guardar carta de término
const storageCartaTermino = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/cartas_termino');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true }); // ✅ CREA la carpeta si no existe
    }
    cb(null, dir); // ✅ Ruta absoluta
  },
  filename: function (req, file, cb) {
    const uniqueName = `carta_termino_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});


// 📄 Configuración para guardar el informe final
const storageInformeFinal = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/informes_finales'); // 📁 asegúrate de crear esta carpeta
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
          'tipo_servicio_social', // 👈 NECESARIO
          'usuario_id'             // 👈 para distinguir estudiante principal
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

    // 👉 Aquí puedes agregar una columna como `informe_final_pdf` si no existe aún en tu modelo
    await trabajo.update({ 
    informe_final_pdf: req.file.filename,
    estado_informe_final: 'pendiente' // 👈 agregar esta línea
  });

    res.status(200).json({ message: 'Informe final guardado correctamente', archivo: req.file.filename });
  } catch (error) {
    console.error('Error al guardar el informe final:', error);
    res.status(500).json({ message: 'Error interno al guardar informe final', error });
  }
});

// Ruta POST para guardar selección
router.post('/',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
    try {
        const {
            usuario_id,
            programa_academico_id,
            docente_id,
            labor_social_id,
            facultad_id,
            tipo_servicio_social,
            linea_accion_id // Agregar facultad_id
        } = req.body;

        // Validaciones mínimas
        if (!usuario_id || isNaN(usuario_id)) {
            return res.status(400).json({ message: 'usuario_id inválido' });
        }
        if (!facultad_id || isNaN(facultad_id)) {  // Validar facultad_id
            return res.status(400).json({ message: 'facultad_id inválido' });
        }   
        if (!['individual', 'grupal'].includes(tipo_servicio_social)) {
          return res.status(400).json({ message: 'tipo_servicio_social inválido' });
        }
        // Ruta completa del archivo

       const nuevoRegistro = await TrabajoSocialSeleccionado.create({
        usuario_id: parseInt(usuario_id),
        programa_academico_id: parseInt(programa_academico_id),
        docente_id: parseInt(docente_id),
        labor_social_id: parseInt(labor_social_id),
        facultad_id: parseInt(facultad_id),
        tipo_servicio_social,
        linea_accion_id: parseInt(linea_accion_id) // ✅ NUEVO CAMPO
      });

        res.status(201).json(nuevoRegistro);
    } catch (error) {
        console.error('Error al guardar selección de labor social:', error);
        res.status(500).json({ message: 'Error al guardar selección', error });
    }
});
// Ruta para obtener el estado del trabajo social por usuario_id
router.get('/usuario/:usuario_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh'),
  async (req, res) => {
  try {
    const usuario_id = req.params.usuario_id;

    const trabajoSocial = await TrabajoSocialSeleccionado.findOne({
      where: { usuario_id },
      // ✅ puedes especificar los atributos si deseas limitar campos:
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
          model: LineaDeAccion, // tu modelo de línea de acción
          as: 'lineaAccion',  // alias según tu asociación
          attributes: ['nombre_linea'] // o 'descripcion', según tu BD
        }
      ]
    });

  if (trabajoSocial) {
      // Convertir a objeto plano y aplanar el campo de línea de acción
      const plain = trabajoSocial.get({ plain: true });
      plain.linea_accion = plain.lineaAccion ? plain.lineaAccion.nombre_linea : '';
      delete plain.lineaAccion; // Opcional: elimina el objeto anidado si no lo necesitas
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

  

router.get('/docente/:docente_id/nuevo',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh'),
  async (req, res) => {
    try {
      const docente_id = req.params.docente_id;

      const trabajosSociales = await TrabajoSocialSeleccionado.findAll({
        where: {
          docente_id,
          // Solo registros con conformidad en 'pendiente'
          conformidad_plan_social: 'pendiente',               // <- filtro clave
          // Si tienes valores con mayúsculas/mixtos, usa una de estas dos opciones:
          // [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.col('conformidad_plan_social')), 'pendiente')],
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
        ]
      });

      res.status(200).json(trabajosSociales);
    } catch (error) {
      console.error('Error al obtener trabajos sociales de docente:', error);
      res.status(500).json({ message: 'Error al obtener trabajos sociales de docente', error });
    }
});




  // Ruta PUT para actualizar el estado del trabajo social
  router.put('/:id',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh'),
  async (req, res) => { 
    try {
      const { id } = req.params;
      const { estado_plan_labor_social, conformidad_plan_social } = req.body;

      const estadosValidos = ['pendiente', 'aceptado', 'rechazado'];

      // Validación de campos requeridos
      if (!estado_plan_labor_social && !conformidad_plan_social) {
        return res.status(400).json({ message: 'Debe proporcionar al menos un campo para actualizar.' });
      }

      // Validaciones de valores permitidos
      if (estado_plan_labor_social && !estadosValidos.includes(estado_plan_labor_social)) {
        return res.status(400).json({ message: 'Estado de plan inválido.' });
      }

      if (conformidad_plan_social && !estadosValidos.includes(conformidad_plan_social)) {
        return res.status(400).json({ message: 'Estado de conformidad inválido.' });
      }

      // Buscar el trabajo social
      const trabajoSocial = await TrabajoSocialSeleccionado.findOne({ where: { id } });

      if (!trabajoSocial) {
        return res.status(404).json({ message: 'Trabajo social no encontrado.' });
      }

      // Preparar los campos a actualizar
      const camposActualizar = {};
      if (estado_plan_labor_social) camposActualizar.estado_plan_labor_social = estado_plan_labor_social;
      if (conformidad_plan_social) camposActualizar.conformidad_plan_social = conformidad_plan_social;

      // 🔥 Si el docente rechaza, eliminar el archivo del plan social
      if (conformidad_plan_social === 'rechazado' && trabajoSocial.archivo_plan_social) {
        const rutaArchivo = path.join(__dirname, '..', 'uploads', 'planes_labor_social', trabajoSocial.archivo_plan_social);

        try {
          if (fs.existsSync(rutaArchivo)) {
            await fs.promises.unlink(rutaArchivo); // elimina físicamente el archivo
            console.log(`Archivo eliminado: ${rutaArchivo}`);
          }
          camposActualizar.archivo_plan_social = null; // limpiar referencia en BD
        } catch (error) {
          console.error('⚠️ Error al eliminar archivo del plan social:', error);
          // No detenemos la ejecución, solo notificamos
        }
      }

      // Actualizar los campos en BD
      await trabajoSocial.update(camposActualizar);

      res.status(200).json({
        message: 'Trabajo social actualizado correctamente.',
        data: trabajoSocial
      });

    } catch (error) {
      console.error('❌ Error al actualizar el trabajo social:', error);
      res.status(500).json({ message: 'Error interno al actualizar el trabajo social.', error });
    }
  });

  
// Ruta para generar y guardar automáticamente un PDF cuando el docente acepta el plan
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

    // Crear nombre y ruta del archivo PDF
    const nombreArchivo = `carta_aceptacion_${trabajo.id}_${Date.now()}.pdf`;
    const rutaArchivo = path.join(__dirname, '../uploads/planes_labor_social', nombreArchivo);

    // Crear el documento PDF
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(rutaArchivo));

    doc.fontSize(18).text('Carta de Aceptación del Plan de Trabajo Social', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Nombre del estudiante: ${trabajo.Estudiante?.nombre_estudiante || 'No registrado'}`);
    doc.text(`Programa académico: ${trabajo.ProgramasAcademico?.nombre_programa || 'N/A'}`);
    doc.text(`Labor social: ${trabajo.LaboresSociale?.nombre_labores || 'N/A'}`);
    doc.text(`Fecha de aceptación: ${new Date().toLocaleDateString()}`);
    doc.end();

    // ❗ Cambiar aquí: guardar en carta_aceptacion_pdf
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
// 📄 Ruta para ver o descargar el PDF generado
router.get('/pdf/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const trabajo = await TrabajoSocialSeleccionado.findByPk(id);

    if (!trabajo || !trabajo.carta_aceptacion_pdf) {
      return res.status(404).json({ message: 'Archivo no encontrado para este trabajo social' });
    }

    const rutaPDF = path.join(__dirname, '../uploads/planes_labor_social', trabajo.carta_aceptacion_pdf);

    // Verifica si el archivo existe
    if (!fs.existsSync(rutaPDF)) {
      return res.status(404).json({ message: 'Archivo PDF no existe en el servidor' });
    }

    // 👉 Para abrir en el navegador:
    res.sendFile(rutaPDF);

    // 👉 Si deseas que se descargue automáticamente en lugar de abrirse:
    // res.download(rutaPDF);

  } catch (error) {
    console.error('Error al servir el PDF:', error);
    res.status(500).json({ message: 'Error interno al servir PDF', error });
  }
});


 // Ruta para guardar el PDF generado en el frontend con html2pdf.js
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

    // Guardar nombre del archivo en la columna `carta_aceptacion_pdf`
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
// ✅ Ruta para obtener un trabajo social por su ID
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

  // Ruta POST para subir archivo del plan social
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

    // ✅ Actualizamos el archivo Y el estado de conformidad
    await trabajo.update({
      archivo_plan_social: archivo,
      conformidad_plan_social: 'pendiente' // ✅ Se asigna recién aquí cuando hace clic
    });

    res.status(200).json({ message: 'Archivo subido correctamente y estado actualizado', archivo });
  } catch (error) {
    console.error('Error al subir el plan social:', error);
    res.status(500).json({ message: 'Error interno al subir archivo', error });
  }
});

// PATCH: Solicitar carta de término (alumno)
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

    // Solo actualizar si no ha sido solicitada aún
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
// PATCH: Aprobar o rechazar solicitud de carta de término (DOCENTE)
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

    // Solo permitir actualizar si fue previamente solicitada
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
// 📩 Ruta para guardar PDF de carta de término generada desde el frontend
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
          'tipo_servicio_social', // ✅ importante para certificados grupales
          'usuario_id'             // ✅ necesario para distinguir al titular
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
      trabajo  // ← aquí corregido
    });
  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.status(500).json({ message: 'Error al actualizar estado', error: error.message });
  }
});

// 📩 Ruta para guardar el certificado final generado desde React-PDF
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
// Ruta para guardar el PDF de carta de término generado desde el frontend con html2pdf.js
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
// Ruta para servir el PDF generado
router.get('/documentos-trabajo/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 👉 Verifica si el id tiene "_", lo que indica que es un miembro del grupo
    const esMiembro = id.includes('_');

    let rutaPDF;

    if (esMiembro) {
      // Ejemplo: id = "143_2019110519"
      const nombreArchivo = `carta_aceptacion_${id}.pdf`;
      rutaPDF = path.join(__dirname, '../uploads/cartas_aceptacion', nombreArchivo);
    } else {
      // Documento del estudiante principal
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
// Ruta para servir el PDF de cartas de término
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
    console.error('❌ Error al servir carta de término:', error);
    res.status(500).json({ message: 'Error interno al servir PDF de término', error });
  }
});

router.get('/seguimiento/:id_estudiante',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor', 'programa-academico'),
  async (req, res) => {
  try {
    const { id_estudiante } = req.params;

    // 1️⃣ Buscar primero al estudiante y su id_usuario
    const estudiante = await Estudiantes.findByPk(id_estudiante, {
      attributes: ['id_estudiante', 'id_usuario', 'nombre_estudiante', 'email'],
      include: [
        { model: ProgramasAcademicos, as: 'programa', attributes: ['nombre_programa'] }
      ]
    });

    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }

    // 2️⃣ Buscar el trámite por id_usuario (que está en trabajo_social_seleccionado)
    const tramite = await TrabajoSocialSeleccionado.findOne({
      where: { usuario_id: estudiante.id_usuario },
      attributes: [
        'estado_plan_labor_social',
        'conformidad_plan_social',
        'solicitud_termino',
        'estado_informe_final'
      ]
    });

    // 3️⃣ Armar la respuesta final con tooltips incluidos
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

      // Buscar el trabajo social correspondiente al usuario
      const trabajo = await TrabajoSocialSeleccionado.findOne({
        where: { usuario_id },
        attributes: ['id']
      });

      if (!trabajo) {
        return res.status(404).json({
          message: 'No se encontró un trabajo social para este estudiante.'
        });
      }

      // Buscar todos los cronogramas vinculados al trabajo social
      const cronogramas = await CronogramaActividades.findAll({
        where: { trabajo_social_id: trabajo.id },
        attributes: ['id', 'actividad', 'fecha_fin_primero'], // ✅ Cambiado 'resultados' por 'actividad'
        order: [['fecha_fin_primero', 'ASC']]
      });

      if (!cronogramas || cronogramas.length === 0) {
        return res.status(404).json({
          message: 'No se encontraron cronogramas para este trabajo social.'
        });
      }

      // Respuesta limpia
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




router.put(
  '/actualizar-fecha/:id',
  authMiddleware,
  verificarRol('gestor-udh', 'docente supervisor'),
  async (req, res) => {
    try {
      const { id } = req.params; // ID del registro del cronograma
      const { fecha_fin_primero, resultados } = req.body;

      // Validación básica
      if (!fecha_fin_primero) {
        return res.status(400).json({ message: 'La fecha_fin_primero es obligatoria.' });
      }

      // Buscar el registro correspondiente
      const cronograma = await CronogramaActividades.findByPk(id);

      if (!cronograma) {
        return res.status(404).json({ message: 'No se encontró el cronograma con el ID especificado.' });
      }

      // Actualizar campos
      cronograma.fecha_fin_primero = fecha_fin_primero;
      if (resultados) cronograma.resultados = resultados;

      await cronograma.save();

      res.status(200).json({
        message: 'Fecha actualizada correctamente',
        cronograma,
      });
    } catch (error) {
      console.error('❌ Error al actualizar la fecha:', error);
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
                as: 'programa', // 👈 usa el alias correcto definido en tu modelo Estudiantes
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
          'programa_academico_id', // 👈 lo incluimos también por si se usa en frontend
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
            plain.Estudiante?.programa?.nombre_programa || '—', // ✅ nombre del programa del estudiante
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
      console.error('❌ Error al obtener trabajos sociales con detalle:', error);
      res.status(500).json({
        message: 'Error interno al obtener trabajos sociales con detalle',
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

      // 🔍 Buscar el registro del trabajo social seleccionado
      const trabajo = await TrabajoSocialSeleccionado.findByPk(id);
      if (!trabajo) {
        return res.status(404).json({
          message: 'No se encontró el trabajo social especificado.',
        });
      }

      // 🔍 Verificar que el nuevo docente exista
      const docenteExiste = await Docentes.findByPk(nuevo_docente_id);
      if (!docenteExiste) {
        return res.status(404).json({
          message: 'El docente seleccionado no existe.',
        });
      }

      // ✏️ Actualizar el campo docente_id
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
      console.error('❌ Error al actualizar el asesor:', error);
      res.status(500).json({
        message: 'Error interno al actualizar el asesor.',
        error: error.message,
      });
    }
  }
);

module.exports = router;
