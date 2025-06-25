// routes/trabajos.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const TrabajoComunitario = require('../models/TrabajoComunitario');
const Validacion = require('../models/Validacion');
// Configuración de almacenamiento con multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Carpeta donde se guardarán las imágenes
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nombre único basado en la fecha
  },
});

const upload = multer({ storage: storage });

// Crear un trabajo comunitario con imagen
router.post('/', upload.single('imagen'), async (req, res) => {
  try {
    const { nombre, descripcion, fecha_inicio, fecha_fin, responsable, ubicacion, monto } = req.body;
    const imagen = req.file ? req.file.filename : null; // Guardar el nombre del archivo de la imagen subida

    const nuevoTrabajo = await TrabajoComunitario.create({
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin,
      responsable,
      ubicacion,
      monto, // Añadir el monto al trabajo comunitario
      imagen,
    });

    res.status(201).json(nuevoTrabajo);
  } catch (error) {
    console.error('Error al crear trabajo comunitario:', error);
    res.status(500).json({ message: 'Error al crear trabajo comunitario', error });
  }
});

// Obtener todos los trabajos comunitarios
router.get('/', async (req, res) => {
  try {
    const trabajos = await TrabajoComunitario.findAll();
    res.status(200).json(trabajos);
  } catch (error) {
    console.error('Error al obtener trabajos comunitarios:', error);
    res.status(500).json({ message: 'Error al obtener trabajos comunitarios', error });
  }
});

// Ruta para obtener todos los trabajos comunitarios asignados, incluyendo el usuario_id para identificar al transportista
router.get('/asignados', async (req, res) => {
  try {
    const trabajosAsignados = await TrabajoComunitario.findAll({
      where: {
        estado: 'asignado',
      },
      attributes: [
        'id_trabajo',
        'nombre',
        'descripcion',
        'ubicacion',
        'estado',
        'imagen',
        'usuario_id', // Incluye el usuario_id para identificar al transportista
      ],
    });
    res.status(200).json(trabajosAsignados);
  } catch (error) {
    console.error('Error al obtener trabajos comunitarios asignados:', error);
    res.status(500).json({ message: 'Error al obtener trabajos comunitarios asignados', error });
  }
});

// Obtener un trabajo comunitario por ID
router.get('/:id_trabajo', async (req, res) => {
  try {
    const trabajo = await TrabajoComunitario.findByPk(req.params.id_trabajo);
    if (trabajo) {
      res.status(200).json(trabajo);
    } else {
      res.status(404).json({ message: 'Trabajo comunitario no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener trabajo comunitario:', error);
    res.status(500).json({ message: 'Error al obtener trabajo comunitario', error });
  }
});

// Actualizar un trabajo comunitario (incluye imagen opcional y asignación de transportista, usuario y multa)
router.put('/:id_trabajo', upload.single('imagen'), async (req, res) => {
  try {
    const trabajo = await TrabajoComunitario.findByPk(req.params.id_trabajo);
    if (trabajo) {
      const {
        nombre,
        descripcion,
        fecha_inicio,
        fecha_fin,
        responsable,
        ubicacion,
        monto, // Agregar el campo monto
        estado, // Agregar el campo estado
        multa_id, // Actualizar el ID de la multa asociada
        usuario_id, // Actualizar el ID del usuario
      } = req.body;

      const imagen = req.file ? req.file.filename : trabajo.imagen; // Si hay una nueva imagen, se actualiza

      // Actualizar el trabajo comunitario con los campos recibidos
      await trabajo.update({
        nombre,
        descripcion,
        fecha_inicio,
        fecha_fin,
        responsable,
        ubicacion,
        monto, // Actualizar el monto
        estado, // Actualizar el estado
        imagen,
        multa_id, // Actualizar la multa asociada
        usuario_id, // Actualizar el ID del usuario asignado
      });

      res.status(200).json(trabajo);
    } else {
      res.status(404).json({ message: 'Trabajo comunitario no encontrado' });
    }
  } catch (error) {
    console.error('Error al actualizar trabajo comunitario:', error);
    res.status(500).json({ message: 'Error al actualizar trabajo comunitario', error });
  }
});

router.delete('/:id_trabajo', async (req, res) => {
  try {
    const { id_trabajo } = req.params;

    const trabajo = await TrabajoComunitario.findByPk(id_trabajo);
    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo comunitario no encontrado' });
    }

    // 🛑 Primero eliminamos las validaciones asociadas
    await Validacion.destroy({
      where: { id_trabajo }
    });

    // ✅ Luego eliminamos el trabajo
    await trabajo.destroy();

    res.status(200).json({ message: 'Trabajo comunitario y sus validaciones eliminados exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar trabajo comunitario:', error);
    res.status(500).json({ message: 'Error al eliminar trabajo comunitario', error });
  }
});
// Obtener todos los trabajos comunitarios realizados por un usuario específico
router.get('/realizados/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;

    // Filtrar trabajos comunitarios completados por el usuario logueado
    const trabajosRealizados = await TrabajoComunitario.findAll({
      where: {
        usuario_id: usuario_id, // Filtra por el usuario asignado
        estado: 'completado',   // Filtra los trabajos con estado 'completado'
      },
    });

    if (trabajosRealizados.length > 0) {
      res.status(200).json(trabajosRealizados);
    } else {
      res.status(404).json({ message: 'No se encontraron trabajos realizados para este usuario.' });
    }
  } catch (error) {
    console.error('Error al obtener los trabajos realizados:', error);
    res.status(500).json({ message: 'Error al obtener los trabajos realizados', error });
  }
});
// Obtener trabajos asignados a un usuario
router.get('/asignados/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const trabajosAsignados = await TrabajoComunitario.findAll({
      where: { usuario_id, estado: 'asignado' },
    });

    if (trabajosAsignados.length > 0) {
      res.status(200).json(trabajosAsignados);
    } else {
      res.status(404).json({ message: 'No hay trabajos asignados para este usuario.' });
    }
  } catch (error) {
    console.error('Error al obtener trabajos asignados:', error);
    res.status(500).json({ message: 'Error al obtener trabajos asignados', error });
  }
});




module.exports = router;
