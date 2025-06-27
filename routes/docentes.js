const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Docentes = require('../models/Docentes');
const Facultades = require('../models/Facultades');
const ProgramasAcademicos = require('../models/ProgramasAcademicos'); // Para incluir el nombre del programa
const Usuario = require('../models/Usuario');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
// 📁 Configuración de almacenamiento de archivos (firma)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/firmas');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `firma-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });
router.get('/perfil', authMiddleware, async (req, res) => {

  try {
    const idUsuario = req.user.id;                   
    const docente = await Docentes.findOne({
      where: { id_usuario: idUsuario },
      attributes: ['dni', 'celular', 'facultad_id', 'programa_academico_id'],
      include: [
        { model: Facultades, as: 'Facultade', attributes: ['nombre_facultad'] },
        { model: ProgramasAcademicos, as: 'ProgramasAcademico', attributes: ['nombre_programa'] }
      ]
    });

    // 4) Resultado
    if (!docente) {
      console.warn('⚠️  Docente NO encontrado para id_usuario:', idUsuario);
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    // 5) Respuesta
    res.json({
      dni: docente.dni,
      celular: docente.celular,
      facultad_id: docente.facultad_id,
      facultad_nombre: docente.Facultade?.nombre_facultad || null,
      programa_id: docente.programa_academico_id,
      programa_nombre: docente.ProgramasAcademico?.nombre_programa || null
    });

  } catch (error) {
    console.error('💥 Error /perfil:', error);
    res.status(500).json({ message: 'Error interno', error: error.message });
  }
});
router.put(
  '/',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh', 'programa-academico'),
  upload.single('firma_digital'),
  async (req, res) => {
    try {
      const { nombre_docente, celular, id_usuario } = req.body;

      const docente = await Docentes.findOne({ where: { id_usuario } });
      if (!docente) {
        return res.status(404).json({ message: 'Docente no encontrado' });
      }

      // Actualizar campos permitidos
      docente.nombre_docente = nombre_docente;
      docente.celular        = celular;
      if (req.file) {
        docente.firma_digital = req.file.filename;
      }

      await docente.save();

      // 🔄 Cambiar campo primera_vez a false si es true
      const usuario = await Usuario.findByPk(id_usuario);
      if (usuario && usuario.primera_vez === true) {
        usuario.primera_vez = false;
        await usuario.save({ fields: ['primera_vez'] });
      }

      return res.status(200).json({ message: 'Docente actualizado correctamente' });

    } catch (error) {
      console.error('Error al actualizar docente:', error);
      return res.status(500).json({ message: 'Error en el servidor al actualizar docente' });
    }
  }
);

// Ruta para crear un nuevo docente
router.post('/',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor'),
  upload.single('firma_digital'),
  async (req, res) => {
  try {
    const { nombre_docente, dni, email, facultad, programa_academico_id, celular, id_usuario } = req.body;
    const firma_digital = req.file ? req.file.filename : null;

    if (!nombre_docente || !dni || !email || !facultad || !programa_academico_id || !celular || !id_usuario || !firma_digital) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios, incluyendo firma digital' });
    }

    const nuevoDocente = await Docentes.create({
      nombre_docente,
      dni,
      email,
      facultad_id: facultad,
      programa_academico_id,
      celular,
      id_usuario,
      firma_digital
    });

    // 🔄 Cambiar campo primera_vez a false
    const usuario = await Usuario.findByPk(id_usuario);
    if (usuario && usuario.primera_vez === true) {
      usuario.primera_vez = false;
      await usuario.save({ fields: ['primera_vez'] });
    }

    res.status(201).json({ message: 'Docente registrado exitosamente', nuevoDocente });
  } catch (error) {
    console.error('Error al registrar docente:', error);
    res.status(500).json({ message: 'Error al registrar docente', error });
  }
});
  
// Obtener todos los docentes
  router.get('/',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor', 'alumno'),
  async (req, res) => {
  try {
    const docentes = await Docentes.findAll({
      include: [
        {
          model: ProgramasAcademicos,
          as: 'ProgramaDelDocente', // 👈 usa alias
          attributes: ['nombre_programa']
        },
        {
          model: Facultades,
          as: 'Facultade', // 👈 usa alias exacto
          attributes: ['nombre_facultad']
        }
      ]
    });
    res.status(200).json(docentes);
  } catch (error) {
    console.error('Error al obtener docentes:', error);
    res.status(500).json({ message: 'Error al obtener docentes', error });
  }
});


// Obtener un docente por ID
router.get('/:id_docente',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor', 'alumno'),
  async (req, res) => {
  try {
    const docente = await Docentes.findByPk(req.params.id_docente, {
      include: {
        model: ProgramasAcademicos,
        attributes: ['nombre_programa'],
      }
    });

    if (docente) {
      res.status(200).json(docente);
    } else {
      res.status(404).json({ message: 'Docente no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener docente:', error);
    res.status(500).json({ message: 'Error al obtener docente', error });
  }
});


router.get('/por-programa/:usuario_id',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const { usuario_id } = req.params;

    // 1. Buscar el programa asociado a este usuario
    const programa = await ProgramasAcademicos.findOne({
      where: { usuario_id }
    });

    if (!programa) {
      return res.status(404).json({ message: 'No se encontró el programa académico para este usuario' });
    }

    // 2. Buscar docentes que tengan ese programa
    const docentes = await Docentes.findAll({
      where: { programa_academico_id: programa.id_programa },
      include: [
        { model: ProgramasAcademicos, attributes: ['nombre_programa'] },
        { model: Facultades, attributes: ['nombre_facultad'] }
      ]
    });

    res.status(200).json(docentes);
  } catch (error) {
    console.error('Error al obtener docentes filtrados:', error);
    res.status(500).json({ message: 'Error interno al filtrar docentes', error });
  }
});
// Actualizar un docente
router.put('/:id_docente',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const docente = await Docentes.findByPk(req.params.id_docente);
    if (docente) {
      const { nombre_docente, programa_academico_id, facultad_id } = req.body;
      await docente.update({ nombre_docente, programa_academico_id, facultad_id }); // ✅ incluir facultad_id
      res.status(200).json(docente);
    } else {
      res.status(404).json({ message: 'Docente no encontrado' });
    }
  } catch (error) {
    console.error('Error al actualizar docente:', error);
    res.status(500).json({ message: 'Error al actualizar docente', error });
  }
});

// Eliminar un docente
router.delete('/:id_docente',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const docente = await Docentes.findByPk(req.params.id_docente);
    if (!docente) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    await docente.destroy();

    res.status(200).json({ message: 'Docente eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar docente:', error);
    res.status(500).json({ message: 'Error al eliminar docente', error });
  }
});

// Obtener id_docente y firma_digital desde id_usuario
router.get('/usuario/:usuario_id',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor', 'alumno'),
  async (req, res) => {
  try {
    const { usuario_id } = req.params;

    const docente = await Docentes.findOne({
      where: { id_usuario: usuario_id },
      attributes: ['id_docente', 'firma_digital']  // 👈 Asegúrate de incluir este campo
    });

    if (!docente) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    // Devuelve ambos campos
    res.status(200).json({
      id_docente: docente.id_docente,
      firma: docente.firma_digital  // 👈 Usa este nombre porque así lo consumes en el frontend
    });

  } catch (error) {
    console.error('Error al buscar docente:', error);
    res.status(500).json({ message: 'Error al obtener docente' });
  }
});
// Obtener docentes de un programa académico específico por ID
router.get('/programa/:programa_id',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor', 'alumno'),
  async (req, res) => {
    const { programa_id } = req.params;  // Obtenemos el ID del programa desde los parámetros de la URL
    
    try {
      // Filtramos los docentes por el ID del programa académico
      const docentes = await Docentes.findAll({
        where: {
          programa_academico_id: programa_id,  // Solo docentes del programa con ID `programa_id`
        },
        include: {
          model: ProgramasAcademicos,
          attributes: ['nombre_programa'], // Incluir el nombre del programa académico
        }
      });
  
      // Si hay docentes, respondemos con los datos
      if (docentes.length > 0) {
        res.status(200).json(docentes);
      } else {
        res.status(404).json({ message: 'No se encontraron docentes para este programa académico.' });
      }
    } catch (error) {
      console.error('Error al obtener docentes del programa:', error);
      res.status(500).json({ message: 'Error al obtener docentes del programa', error });
    }
  });
router.get('/datos/usuario/:usuario_id',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor'),
  async (req, res) => {
    try {
      const { usuario_id } = req.params;

      const docente = await Docentes.findOne({
        where: { id_usuario: usuario_id },
        include: [
          {
            model: Facultades,
            as: 'Facultade', // 👈 ALIAS definido en el modelo
            attributes: ['id_facultad', 'nombre_facultad']
          },
          {
            model: ProgramasAcademicos,
            as: 'ProgramaDelDocente', // 👈 ALIAS definido en el modelo
            attributes: ['id_programa', 'nombre_programa']
          }
        ]
      });

      if (!docente) {
        return res.status(404).json({ message: 'Docente no encontrado' });
      }

      res.status(200).json(docente);
    } catch (error) {
      console.error('Error al obtener datos del docente:', error);
      res.status(500).json({ message: 'Error al obtener datos del docente', error: error.message });
    }
  }
);
// Actualizar el celular del docente por id_usuario
router.put('/actualizar-celular/:id_usuario',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const { celular } = req.body;

    const docente = await Docentes.findOne({ where: { id_usuario } });

    if (!docente) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    docente.celular = celular;
    await docente.save();

    res.status(200).json({ message: 'Celular actualizado correctamente', docente });
  } catch (error) {
    console.error('Error al actualizar celular del docente:', error);
    res.status(500).json({ message: 'Error al actualizar celular del docente', error });
  }
});
router.get('/docente/:id', async (req, res) => {
  const idDocente = req.params.id; // Obtenemos el id_docente desde la URL

  try {
    // Buscar el docente por id_docente
    const docente = await Docentes.findOne({
      where: { id_docente: idDocente },
    });

    // Si no encontramos el docente
    if (!docente) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    // Retornamos los datos del docente
    res.json(docente);
  } catch (error) {
    console.error('Error al obtener docente:', error);
    res.status(500).json({ message: 'Error al obtener docente', error: error.message });
  }
});
router.get('/verificar-docente/:id_docente', async (req, res) => {
  const { id_docente } = req.params;

  try {
    // Buscar el docente por su id_docente
    const docente = await Docentes.findOne({
      where: { id_docente },
      include: [
        {
          model: Usuario,  // Sin alias
          attributes: ['id_usuario', 'email', 'dni', 'whatsapp']  // Campos que deseas obtener del usuario
        }
      ]
    });

    // Si no se encuentra el docente, devolver un error
    if (!docente) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    // Si se encuentra el docente, devolver los datos del docente y del usuario asociado
    res.status(200).json({
      message: 'Docente encontrado',
      docente: docente,  // El objeto completo del docente
      usuario_id: docente.Usuario.id_usuario,  // El id_usuario asociado al docente
      usuario_email: docente.Usuario.email,    // El email del usuario asociado
      usuario_dni: docente.Usuario.dni,        // El DNI del usuario asociado
      usuario_whatsapp: docente.Usuario.whatsapp // El whatsapp del usuario asociado
    });

  } catch (error) {
    // Si ocurre un error, devolver un mensaje de error
    console.error('Error al verificar el docente:', error);
    res.status(500).json({ message: 'Error al verificar el docente', error: error.message });
  }
});






module.exports = router;
