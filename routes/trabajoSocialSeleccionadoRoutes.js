const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const router = express.Router();
const multer = require('multer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const TrabajoSocialSeleccionado = require('../models/TrabajoSocialSeleccionado');
// Asegúrate de importar el modelo ProgramasAcademicos correctamente
const ProgramasAcademicos = require('../models/ProgramasAcademicos');
const LaboresSociales = require('../models/LaboresSociales');
const Estudiantes = require('../models/Estudiantes');
const Facultades = require('../models/Facultades'); // asegúrate de que el path esté bien
const LineaDeAccion = require('../models/LineaDeAccion'); 


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
    cb(null, 'uploads/cartas_termino');
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
          'certificado_final'
        ]
      });

      res.status(200).json(informes);
    } catch (error) {
      console.error('Error al obtener informes finales:', error);
      res.status(500).json({ message: 'Error interno al obtener informes finales', error });
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

  
  // Ruta PUT para actualizar el estado del trabajo social
  router.put('/:id',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh'),
  async (req, res) => { 
    try {
      const { id } = req.params;
      const { estado_plan_labor_social, conformidad_plan_social } = req.body;
  
      const estadosValidos = ['pendiente', 'aceptado', 'rechazado'];
  
      // Verifica si se envió al menos un campo válido
      if (!estado_plan_labor_social && !conformidad_plan_social) {
        return res.status(400).json({ message: 'Debe proporcionar al menos un campo para actualizar.' });
      }
  
      // Validaciones individuales si se proporciona el campo
      if (estado_plan_labor_social && !estadosValidos.includes(estado_plan_labor_social)) {
        return res.status(400).json({ message: 'Estado de plan inválido' });
      }
  
      if (conformidad_plan_social && !estadosValidos.includes(conformidad_plan_social)) {
        return res.status(400).json({ message: 'Estado de conformidad inválido' });
      }
  
      const trabajoSocial = await TrabajoSocialSeleccionado.findOne({ where: { id } });
  
      if (!trabajoSocial) {
        return res.status(404).json({ message: 'Trabajo social no encontrado' });
      }
  
      // Prepara los campos a actualizar
      const camposActualizar = {};
      if (estado_plan_labor_social) camposActualizar.estado_plan_labor_social = estado_plan_labor_social;
      if (conformidad_plan_social) camposActualizar.conformidad_plan_social = conformidad_plan_social;
  
      await trabajoSocial.update(camposActualizar);
  
      res.status(200).json(trabajoSocial);
    } catch (error) {
      console.error('Error al actualizar el trabajo social:', error);
      res.status(500).json({ message: 'Error interno al actualizar', error });
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
      'certificado_final' 
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
      carta_termino_pdf: req.file.filename // 👈 este campo debe existir en tu modelo
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

    // Busca el trabajo social en la base de datos
    const trabajo = await TrabajoSocialSeleccionado.findByPk(id);

    // Si no se encuentra el trabajo o no tiene PDF asociado
    if (!trabajo || !trabajo.carta_aceptacion_pdf) {
      return res.status(404).json({ message: 'Archivo no encontrado para este trabajo social' });
    }

    // Ruta del archivo PDF en el servidor
    const rutaPDF = path.join(__dirname, '../uploads/planes_labor_social', trabajo.carta_aceptacion_pdf);

    // Verifica si el archivo existe
    if (!fs.existsSync(rutaPDF)) {
      return res.status(404).json({ message: 'Archivo PDF no existe en el servidor' });
    }

    // Si el archivo existe, lo manda al navegador
    res.sendFile(rutaPDF);

  } catch (error) {
    console.error('Error al servir el PDF:', error);
    res.status(500).json({ message: 'Error interno al servir PDF', error });
  }
});

module.exports = router;
